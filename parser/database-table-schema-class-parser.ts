import LanguageDefinition from "../languages/language-definition";
import SqliteLanguageDefinition from "../languages/sqlite-language-definition";
import { DefinitionHelper, DefinitionReferenceHelper, RelationshipType } from "./language-parser";
import ParameterDefinition from "./definitions/parameter-definition";
import TypeDefinition from "./definitions/type-definition";
import ModelClassParser from "./model-class-parser";
import PropertyDefinition from "./definitions/property-definition";
import StringUtils from "../string-utils";
import ClassDefinition from "./definitions/class-definition";
import MethodDefinition from "./definitions/method-definition";

export default class DatabaseTableSchemaClassParser {
    static STRING_TO_ARRAY_SEPARATOR = ';';
    static classSufix = 'TableSchema';
    static tableNameProperty = 'TABLE_NAME';
    static databaseObject = new ParameterDefinition('db', new TypeDefinition('SQLiteDatabase'));

    languageDefinition: LanguageDefinition;
    databaseLanguageDefinition: SqliteLanguageDefinition;
    definition: DefinitionHelper;

    constructor(languageDefinition: LanguageDefinition, databaseLanguageDefinition: SqliteLanguageDefinition, definition: DefinitionHelper) {
        this.languageDefinition = languageDefinition;
        this.databaseLanguageDefinition = databaseLanguageDefinition;
        this.definition = definition;
    }

    parse() {
        const nativeDependencies = [
            new DefinitionHelper('android.database.sqlite.SQLiteDatabase', null, null),
            new DefinitionHelper('android.database.Cursor', null, null),
        ];
        const className = this.definition.name;
        const tableClassName = `${className}${DatabaseTableSchemaClassParser.classSufix}`;

        const fields = this.parseProperties();
        
        const parseDependencies = ModelClassParser.parseDependencies(this.definition);

        const dependencies = [
            ...nativeDependencies, 
            ...parseDependencies,
            ...parseDependencies.map((dependency) => {
                if (dependency.needsTable) {
                    return new DefinitionHelper(`${dependency.name}${DatabaseTableSchemaClassParser.classSufix}`, null, null);
                }
                return null;
            }).filter((dependency) => {
                return dependency != null;
            }),
        ];
        
        let tableNameString = new PropertyDefinition(
            DatabaseTableSchemaClassParser.tableNameProperty,
            new TypeDefinition(this.languageDefinition.stringKeyword),
            this.languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(className).toLowerCase()),
            null,
            false);

        const methods = [
            this.createCreateTableMethod(fields),
            this.createReadFromDbMethod(fields),
            this.createInsertOrUpdateMethod(fields),
            this.createBatchInsertOrUpdateMethod(),
            this.createDeleteMethod(),
            this.createReadListFromDbMethod(),
            this.createSelectMethod(),
            this.createSelectAllMethod(),
            this.createSelectByIdMethod(),
            ...this.createMethodsBasedOnDependencies(fields),
        ];

        const properties = this.getAllProperties(tableNameString, fields);

        const tableClass = new ClassDefinition(tableClassName, properties, null, methods, null, dependencies);

        return tableClass;
    }

    getAllProperties(tableNameString: PropertyDefinition, fields: Array<DatabaseFieldHelper>): Array<PropertyDefinition> {
        const properties = [tableNameString, ...fields.filter((field) => {
            return !field.fromClass;
        }).map((field) => {
            return field.toProperty();
        })];

        fields.filter((field) => {
            return field.fromClass;
        }).map((field) => {
            field.fromClass.map((newField) => {
                properties.push(newField.toProperty());
            });
        });
        return properties;
    }

    parseProperties(): Array<DatabaseFieldHelper> {
        let fields = this.definition.properties.map((property) => {
            let subObject = null;
            const subProperties = property.subProperties;
            if (subProperties ) {
                const propertiesFromClass = subProperties.map((subProperty) => {
                    const prefix = property.name;
                    subObject = new DatabaseFieldHelper(
                        this.databaseLanguageDefinition,
                        this.languageDefinition,
                        subProperty.name,
                        ModelClassParser.getPropertyType(this.languageDefinition, subProperty),
                        subProperty.required, null);
                    subObject.fieldName = `${prefix.toUpperCase()}_${subObject.fieldName}`;
                    subObject.databaseFieldName = `${prefix}_${subObject.databaseFieldName}`;
                    subObject.fromClass = property.name;
                    return subObject;
                });

                return new DatabaseFieldHelper(this.databaseLanguageDefinition,
                    this.languageDefinition,
                    property.name,
                    ModelClassParser.getPropertyType(this.languageDefinition, property),
                    property.required,
                    propertiesFromClass);
            }

            return new DatabaseFieldHelper(this.databaseLanguageDefinition, this.languageDefinition,
                property.name,
                ModelClassParser.getPropertyType(this.languageDefinition, property),
                property.required,
                subObject);
        });

        return fields;
    }

    createCreateTableMethod(fields: Array<DatabaseFieldHelper>) {
        let typedFields = fields.filter((field) => {
            return !field.searchById && !field.fromClass;
        });

        fields.filter((field) => {
            return field.fromClass;
        }).map((field) => {
            field.fromClass.map((field) => {
                typedFields.push(field);
            });
        });

        const databaseFields = typedFields.map((field) => {
            const properties = field.getDatabaseFieldProperties();

            try {
                let fieldString = `\t\t\t\t\`${this.languageDefinition.stringReplacement}\` ${field.databaseType.name}`;
                if (properties) {
                    fieldString += ` ${properties}`;
                }
                return fieldString;
            } catch (e) {
                console.log(field);
                return null;
            }
        }).join(',\n');

        const parameters = typedFields.map((field) => {
            return `\t\t${this.languageDefinition.thisKeyword}.${field.fieldName}`;
        });

        const tablePlusParameters = [`${this.languageDefinition.thisKeyword}.TABLE_NAME`, ...parameters];
        
        const tableString = this.languageDefinition.stringDeclaration(`${this.databaseLanguageDefinition.createTable} \`${this.languageDefinition.stringReplacement}\` (
    ${databaseFields}
\t\t\t)`);
        const methodCall = `${this.languageDefinition.methodCall(tableString, 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${this.languageDefinition.methodCall('db', 'execSQL', [methodCall])};`;

        return new MethodDefinition('createTable',
            null,
            [
                DatabaseTableSchemaClassParser.databaseObject
            ],
            methodString,
            this.languageDefinition.publicKeyword);
    }

    classNameToVar(className: string): string {
        return className.substr(0, 1).toLowerCase() + className.substr(1);
    }

    varNameToClass(className: string): string {
        return className.substr(0, 1).toUpperCase() + className.substr(1);
    }

    createReadFromDbMethod(fields: Array<DatabaseFieldHelper>) {
        const className = this.definition.name;
        const varName = this.classNameToVar(className);

        const parameters = fields.map((field) => {
            const nonNative = this.handleNonNativeTypes(field);
            if (nonNative) {
                return nonNative;
            }
            switch(field.databaseType.name) {
                case this.databaseLanguageDefinition.numberKeyword:
                    return `${this.languageDefinition.methodCall('cursor', 'getDouble', [`${this.languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case this.databaseLanguageDefinition.stringKeyword:
                    return `${this.languageDefinition.methodCall('cursor', 'getString',  [`${this.languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case this.databaseLanguageDefinition.integerKeyword:
                    return `${this.languageDefinition.methodCall('cursor', 'getInt',  [`${this.languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                default:
                   // throw new Error(`QUE? ${JSON.stringify(field)}`);
                   return null;
            }
        });

        let methodString = `\t\t${this.languageDefinition.variableDeclaration(this.languageDefinition.constKeyword, 
            new TypeDefinition(className), 
            varName, 
            this.languageDefinition.constructObject(new TypeDefinition(className), parameters))}`;
        methodString += `\n\t\t${this.languageDefinition.returnDeclaration(varName)}`;

        return new MethodDefinition('readFromDb', 
            new TypeDefinition(className),
            [   
                new ParameterDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodString,
            this.languageDefinition.publicKeyword);
    }

    handleNonNativeTypes(field: DatabaseFieldHelper) {
        const className = this.definition.name;
        if (field.fromClass) {
            const params = field.fromClass.map((field) => {
                return this.languageDefinition.methodCall('cursor', 'getInt', [`${this.languageDefinition.thisKeyword}.${field.fieldName}`]);
            });

            return this.languageDefinition.constructObject(field.type, params);
        }
        if (field.searchByDependencyId) {
            const constructObject = this.languageDefinition.constructObject(new TypeDefinition(`${field.type.name}${DatabaseTableSchemaClassParser.classSufix}`), null);
            let getId = this.languageDefinition.methodCall('cursor', 'getInt', [`${this.languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectById`, [getId])}`;
        }
        if (field.searchById) {
            const constructObject = this.languageDefinition.constructObject(new TypeDefinition(`${className}${DatabaseTableSchemaClassParser.classSufix}`), null);
            let getId = this.languageDefinition.methodCall('cursor', 'getInt', [`${this.languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectBy${className}Id`, [getId])}`;
        }
        if (field.isArrayOfString) {
            const callCursorGetStringMethod = this.languageDefinition.methodCall('cursor', 'getString', 
                [`${this.languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${this.languageDefinition.methodCall(
                callCursorGetStringMethod, 
                'split', [this.languageDefinition.stringDeclaration(DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR)]
            )}`;
        }
        return null;
    }

    createInsertOrUpdateMethod(fields: Array<DatabaseFieldHelper>) {
        const className = this.definition.name;
        const interrogations: Array<string> = [];
        const stringReplacements: Array<string> = [];

        const objectName = this.classNameToVar(className);

        const { onlyNativeTypes, nonNativeTypes } = this.getFieldsSeparatedByNative(fields)

        onlyNativeTypes.filter((property) => {
            return property.fieldName !== 'id';
        }).map(() => {
            interrogations.push('?');
            stringReplacements.push(`\`${this.languageDefinition.stringReplacement}\``);
        });

        const sql = `${this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.insertOrUpdateKeyword} \`${this.languageDefinition.stringReplacement}\` (${stringReplacements.join(', ')}) ${this.databaseLanguageDefinition.valuesKeyword} (${interrogations.join(', ')})`)}`;
        
        const statement = `${this.languageDefinition.methodCall(sql, 'format', this.getFields(onlyNativeTypes, objectName))}`;
        
        const callExecSqlMethod = this.languageDefinition.methodCall('db', 'execSQL', [statement]);

        let methodString = `\t\t${this.languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        if (nonNativeTypes.length > 0) {
            methodString = this.getInsertMethodForNonNativeTypes(nonNativeTypes, objectName, methodString, statement);
        }

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(`${objectName}`, new TypeDefinition(`${className}`))
            ],
            methodString,
            this.languageDefinition.publicKeyword);
    }

    getInsertMethodForNonNativeTypes(nonNativeTypes: Array<DatabaseFieldHelper>, objectName: string, methodString: string, statement: string) {
        const methods = nonNativeTypes.filter((property) => {
            return property.type.subtype != null;
        }).map((property) => {
            let methodName = 'insertOrUpdate';
            if (property.type.name.indexOf(this.languageDefinition.arrayKeyword) > -1) {
                methodName = 'batchInsertOrUpdate';
            }
            const constructObject = this.languageDefinition.constructObject(new TypeDefinition(`${property.type.subtype.name}${DatabaseTableSchemaClassParser.classSufix}`), []);
            return `\t\t${this.languageDefinition.methodCall(constructObject, methodName, ['db', `${objectName}.${property.propertyName}`])};`;
        }).join('\n');

        const callExecSqlMethod = this.languageDefinition.methodCall('db', 'execSQL', [statement]);
        methodString = `\t\t${this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.intKeyword), 
            'result',
            callExecSqlMethod)}

${methods}

\t\t${this.languageDefinition.returnDeclaration('result')}`;
        return methodString;
    }

    getFieldsSeparatedByNative(fields: Array<DatabaseFieldHelper>): any {
        const onlyNativeTypes: Array<DatabaseFieldHelper> = [];
        const nonNativeTypes: Array<DatabaseFieldHelper> = [];

        fields.forEach((property) => {
            if (this.checkIfPropertyIsNativeType(property)) {
                onlyNativeTypes.push(property);
            } else {
                if (property.fromClass) {
                    property.fromClass.forEach((property) => {
                        if (this.checkIfPropertyIsNativeType(property)) {
                            onlyNativeTypes.push(property);
                        } else {
                            nonNativeTypes.push(property);
                        }
                    });
                } else if (property.isArrayOfString || property.type.subtype) {
                    nonNativeTypes.push(property);
                } else {
                    onlyNativeTypes.push(property);
                }
            }
        });

        return { onlyNativeTypes, nonNativeTypes };
    }

    checkIfPropertyIsNativeType(property: DatabaseFieldHelper): boolean {
        return (property.type.isNative && !property.type.subtype) || property.isArrayOfString || property.type.isEnum;
    }

    getFields(properties: Array<DatabaseFieldHelper>, objectName: string) {
        let fields = [`${this.languageDefinition.thisKeyword}.TABLE_NAME`];
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            return `${this.languageDefinition.thisKeyword}.${property.fieldName}`;
        }));
        
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            if (property.isArrayOfString) {
                return `${this.languageDefinition.methodCall(`${objectName}.${property.propertyName}`, 'join', 
                    [this.languageDefinition.stringDeclaration(DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR)])}`;
            }
            if (property.fromClass) {
                return `${objectName}.${property.fromClass}.${property.propertyName}`;
            } else if (!property.type.isNative && !property.type.subtype) {
                return `${objectName}.${property.propertyName}.id`;
            } else {
                return `${objectName}.${property.propertyName}`;
            }
        }));
        return fields;
    }

    createBatchInsertOrUpdateMethod() {
        const className = this.definition.name;
        const objectName = this.classNameToVar(className);

        const callInsertOrUpdateMethod = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'insertOrUpdate', ['db', objectName]);
        let mapBodyString = `\t\t${this.languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        const callMapMethod = this.languageDefinition.lambdaMethod(objectName, 'map', objectName, mapBodyString);
        let methodString = `\t\t${this.languageDefinition.returnDeclaration(callMapMethod)}`;

        return new MethodDefinition('batchInsertOrUpdate',
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.languageDefinition.intKeyword)),
            [
                DatabaseTableSchemaClassParser.databaseObject, 
                new ParameterDefinition(objectName, new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(className))),
            ],
            methodString,
            this.languageDefinition.publicKeyword);
    }

    createDeleteMethod() {
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.deleteKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} = ${this.databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = this.languageDefinition.methodCall(sql, 'format', 
            [`${this.languageDefinition.thisKeyword}.TABLE_NAME`, `${this.languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = this.languageDefinition.methodCall('db', 'execSQL', [formatMethodCall, 'id']);
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;
        return new MethodDefinition('deleteById',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject, 
                new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.intKeyword)),
            ],
            returnCall,
            this.languageDefinition.publicKeyword);
    }

    createReadListFromDbMethod() {
        const listDeclaration = this.createListObject();

        const cursorMoveToNext = this.languageDefinition.methodCall('cursor', 'moveToNext', null);
        const readFromDbMethodCall = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'readFromDb', ['cursor']);
        const whileBody = `\t\t${this.languageDefinition.methodCall('list', 'add', [readFromDbMethodCall])}`;
        const whileStatement = this.languageDefinition.whileStatement(cursorMoveToNext, whileBody);
        const returnCall = `${this.languageDefinition.returnDeclaration('list')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${whileStatement}
\t\t${returnCall}`
        return new MethodDefinition('readListFromDb', 
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                new ParameterDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodBody,
            this.languageDefinition.publicKeyword);
    }

    createListObject() {
        let listConstruct = this.languageDefinition.arrayListKeyword;
        if (this.languageDefinition.shouldConstructList) {
            listConstruct = this.languageDefinition.constructObject(new TypeDefinition(this.languageDefinition.arrayListKeyword), null);
        }
        const listDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.arrayListKeyword, false, new TypeDefinition(this.definition.name)),
            'list',
            listConstruct);
        return listDeclaration;
    }

    createSelectMethod() {
        const cursorDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.variableKeyword,
            new TypeDefinition('Cursor'),
            'cursor', 
            null);
        const listDeclaration = this.createListObject();

        const dbExecCall = this.languageDefinition.methodCall('db', 'rawQuery', ['sql', 'args']);
        const assignRawQueryToCursor = this.languageDefinition.assignment('cursor', dbExecCall);
        const callReadListFromDbMethod = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'readListFromDb', ['cursor']);
        const assignList = this.languageDefinition.assignment('list', callReadListFromDbMethod);
        const tryBody = `\t\t${assignRawQueryToCursor}
\t\t\t${assignList}`;
        const catchBody = `\t\t\t${this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'onError', null)}`;
        const finallyBody = `\t\t\t${this.languageDefinition.methodCall('cursor', 'close', null)}
\t\t\t${this.languageDefinition.methodCall('db', 'close', null)}`;
        const tryCatch = this.languageDefinition.tryCatchStatement(tryBody, catchBody, finallyBody);

        const returnCall = this.languageDefinition.returnDeclaration('list');

        const methodBody = `\t\t${listDeclaration}
\t\t${cursorDeclaration}

${tryCatch}

\t\t${returnCall}`;

        return new MethodDefinition('select', 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('sql', new TypeDefinition(this.languageDefinition.stringKeyword)),
                new ParameterDefinition('args', new TypeDefinition(this.languageDefinition.stringKeyword), null, false, [this.languageDefinition.varargsKeyword]),
            ],
            methodBody,
            this.languageDefinition.publicKeyword);
    }

    createSelectAllMethod() {
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`
        );

        const formatMethodCall = this.languageDefinition.methodCall(sql, 'format', 
            [`${this.languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'select', [formatMethodCall, this.languageDefinition.nullKeyword]);
        
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition('selectAll', 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
            ],
            returnCall,
            this.languageDefinition.publicKeyword);
    }

    createSelectByIdMethod() {
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} = ${this.databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = this.languageDefinition.methodCall(sql, 'format', 
                [`${this.languageDefinition.thisKeyword}.TABLE_NAME`, `${this.languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'select', [formatMethodCall, 'id']);

        const listDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.arrayListKeyword, false, new TypeDefinition(this.definition.name)),
            'list', dbExecCall);

        const returnCall = `${this.languageDefinition.returnDeclaration('list[0]')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${returnCall}`;

        return new MethodDefinition('selectById',
            new TypeDefinition(this.definition.name),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.intKeyword)),
            ],
            methodBody,
            this.languageDefinition.publicKeyword);
    }

    createMethodsBasedOnDependencies(fields: Array<DatabaseFieldHelper>) {
        const methods = this.definition.references.filter((reference) => {
            return reference.relationship != RelationshipType.ONE_TO_ONE;
        }).map((reference) => {
            const fieldReference = fields.find((field) => {
                return field.propertyName = reference.property.name;
            });

            if (reference.relationship === RelationshipType.ONE_TO_N) {
                return this.createMethodToSelectOneToN();
            } else {
                return this.createMethodToSelectNToOne(reference, fieldReference);
            }
        });

        var dups = new Map<Object, boolean>();
        return methods.filter(function(method) {
            var hash = method.valueOf();
            var isDup = dups.get(hash);
            dups.set(hash, true);
            return !isDup;
        });
    }

    createMethodToSelectOneToN() {
        const methodName = `selectAllIdsInList`;
        let sql = `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`;
        const returnInterrogation = `\t\t${this.languageDefinition.returnDeclaration(this.languageDefinition.stringDeclaration('?'))}`;
        const interrogations = this.languageDefinition.lambdaMethod('ids', 'map', '', returnInterrogation);
        const interrogationsJoined = this.languageDefinition.methodCall(interrogations, 'join', [this.languageDefinition.stringDeclaration(', ')]);
        const interrogationsVar = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.stringKeyword),
            'interrogations',
            interrogationsJoined);
        sql += ` ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.inKeyword} (${this.languageDefinition.stringReplacement})`;
        sql = this.languageDefinition.stringDeclaration(sql);
        const formatMethodCall = this.languageDefinition.methodCall(sql, 'format', 
            [`${this.languageDefinition.thisKeyword}.TABLE_NAME`, `${this.languageDefinition.thisKeyword}.ID_FIELD`, 'interrogations']);

        const dbExecCall = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'select', [formatMethodCall, 'ids']);
        
        const returnCall = `\t\t${interrogationsVar}\n\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('ids', new TypeDefinition(this.languageDefinition.arrayKeyword, false, new TypeDefinition(this.languageDefinition.stringKeyword))),
            ],
            returnCall,
            this.languageDefinition.publicKeyword);
    }

    createMethodToSelectNToOne(reference: DefinitionReferenceHelper, fieldReference: DatabaseFieldHelper) {
        const methodName = `selectBy${reference.definition.name}Id`;
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`
        );
        const formatMethodCall = this.languageDefinition.methodCall(sql, 'format', 
            [`${this.languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = this.languageDefinition.methodCall(this.languageDefinition.thisKeyword, 'select', [formatMethodCall, this.languageDefinition.nullKeyword]);
        
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(fieldReference.propertyName, new TypeDefinition(this.languageDefinition.stringKeyword)),
            ],
            returnCall,
            this.languageDefinition.publicKeyword);
    }
}

class DatabaseFieldHelper {
    static FIELD_SUFIX = '_FIELD';

    databaseLanguageDefinition: SqliteLanguageDefinition;
    languageDefinition: LanguageDefinition;

    type: TypeDefinition;
    propertyName: string;
    fieldName: string;
    databaseFieldName: string;
    databaseType: DatabaseTypeHelper;
    searchById: boolean;
    searchByDependencyId: boolean;
    isArrayOfString: boolean;
    fromClass: Array<DatabaseFieldHelper>;
    required: boolean

    constructor(databaseLanguageDefinition: SqliteLanguageDefinition, languageDefinition: LanguageDefinition, 
            propertyName: string, type: TypeDefinition, required: boolean, fromClass: Array<DatabaseFieldHelper> = null) {
        this.databaseLanguageDefinition = databaseLanguageDefinition;
        this.languageDefinition = languageDefinition;
        
        this.type = type;
        this.propertyName = propertyName;
        let splittedName = StringUtils.splitNameWithUnderlines(this.propertyName);
        this.fieldName = `${splittedName.toUpperCase()}${DatabaseFieldHelper.FIELD_SUFIX}`;
        this.searchById = false;
        this.searchByDependencyId = false;
        this.isArrayOfString = false;

        if (this.type.subtype && !this.type.subtype.isNative) { // Is an array of other model
            this.searchById = true;
            this.searchByDependencyId = false;
            this.fieldName = 'ID_FIELD';
            this.databaseFieldName = null;
        } else if (!this.type.subtype && !this.type.isNative && !fromClass) { // Is not an array
            this.searchById = false;
            this.searchByDependencyId = true;
            splittedName = `${splittedName}_ID`;
            this.fieldName = `${splittedName.toUpperCase()}${DatabaseFieldHelper.FIELD_SUFIX}`;
            this.databaseType = new DatabaseTypeHelper(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else if (this.type.subtype && DatabaseFieldHelper.isArrayOfString(languageDefinition, this.type)) {
            this.isArrayOfString = true;
            this.databaseType = new DatabaseTypeHelper(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else {
            if (fromClass) {
                this.fromClass = fromClass;
            }
            this.databaseType = new DatabaseTypeHelper(this.type, languageDefinition, databaseLanguageDefinition);
        }

        this.databaseFieldName = splittedName.toLowerCase();
        this.required = required;
    }

    static isArrayOfString(languageDefinition: LanguageDefinition, type: TypeDefinition) {
        return type.name.indexOf(languageDefinition.arrayKeyword) > - 1 && type.subtype.name === languageDefinition.stringKeyword;
    }

    toProperty() {
        return new PropertyDefinition(this.fieldName, 
            new TypeDefinition(this.languageDefinition.stringKeyword, true),
            this.languageDefinition.stringDeclaration(this.databaseFieldName),
            this.required,
            true);
    }

    getDatabaseFieldProperties() {
        let properties = [];
        if (this.propertyName === 'id') {
            properties.push(this.databaseLanguageDefinition.notNullKeyword);
            properties.push(this.databaseLanguageDefinition.primaryKeyKeyword);
        } else if (this.required) {
            properties.push(this.databaseLanguageDefinition.notNullKeyword);
        }

        return properties.join(' ');
    }
}

class DatabaseTypeHelper {
    name: string;
    type: TypeDefinition;

    constructor(type: TypeDefinition, languageDefinition: LanguageDefinition, databaseLanguageDefinition: SqliteLanguageDefinition) {
        this.type = type;
        if (type.isEnum) {
            this.name = databaseLanguageDefinition.stringKeyword;
        } else if (type.name === languageDefinition.stringKeyword) {
            this.name = databaseLanguageDefinition.stringKeyword;
        } else if (type.name === languageDefinition.numberKeyword) {
            this.name = databaseLanguageDefinition.numberKeyword;
        } else if (type.name === languageDefinition.intKeyword || type.name === languageDefinition.booleanKeyword) {
            this.name = databaseLanguageDefinition.integerKeyword;
        } else {
            this.name = null;
        }
    }
}