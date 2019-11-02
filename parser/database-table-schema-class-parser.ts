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
import Parser from "./parser-interface";
import { LanguageSettings, TypeOfClass } from "../configuration";
import Languages from "../languages/languages";
import KotlinClassDefinition from "./definitions/kotlin-class-definition";

export default class DatabaseTableSchemaClassParser implements Parser {
    static STRING_TO_ARRAY_SEPARATOR = ';';
    static classSufix = 'TableSchema';
    static tableNameProperty = 'TABLE_NAME';
    static databaseObject = new ParameterDefinition('db', new TypeDefinition('SQLiteDatabase'));
    static cursor = new PropertyDefinition('cursor', new TypeDefinition('Cursor'));

    languageDefinition: LanguageDefinition;
    databaseLanguageDefinition: SqliteLanguageDefinition;
    definition: DefinitionHelper;
    configuration: LanguageSettings;
    className: PropertyDefinition;

    thisKeyword: PropertyDefinition;

    constructor(languageDefinition: LanguageDefinition, databaseLanguageDefinition: SqliteLanguageDefinition, definition: DefinitionHelper, configuration: LanguageSettings) {
        this.languageDefinition = languageDefinition;
        this.databaseLanguageDefinition = databaseLanguageDefinition;
        this.definition = definition;
        this.configuration = configuration;
        this.thisKeyword = new PropertyDefinition(this.languageDefinition.thisKeyword, new TypeDefinition(this.definition.name));
    }

    parse(): ClassDefinition {
        const nativeDependencies = [
            'android.database.sqlite.SQLiteDatabase',
            'android.database.Cursor',
            'android.content.ContentValues',
        ];
        const className = this.definition.name;
        this.className = new PropertyDefinition(`${className}${DatabaseTableSchemaClassParser.classSufix}`, new TypeDefinition(this.definition.name));

        const fields = this.parseProperties();
        
        const parseDependencies = ModelClassParser.parseDependencies(this.definition, this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES));

        const classSettings = this.configuration.getClassSettings(TypeOfClass.DATABASE_CLASSES);

        let inherits = null;
        if (classSettings.inheritsFrom) {
            inherits = TypeDefinition.typeBySplittingPackageAndName(classSettings.inheritsFrom, className);
        }
        const implementsInterfaces = classSettings.implementsInterfaces.map((interfaceString) => {
            return TypeDefinition.typeBySplittingPackageAndName(interfaceString, className);
        });

        const dependencies = [
            ...nativeDependencies, 
            `${this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES).package}.${this.definition.name}`,
            ...parseDependencies,
            inherits ? inherits.package : null,
            ...implementsInterfaces.map((interfaceType) => {
                return interfaceType.package;
            }),
            ...this.definition.references.map((dependency) => {
                if (dependency.definition.needsTable) {
                    return `${classSettings.package}.${dependency.definition.name}${DatabaseTableSchemaClassParser.classSufix}`;
                }
                return null;
            }).filter((dependency) => {
                return dependency != null;
            }),
        ].filter((dependency) => {
            return dependency !== null;
        });
        
        let tableNameString = new PropertyDefinition(
            DatabaseTableSchemaClassParser.tableNameProperty,
            new TypeDefinition(this.languageDefinition.stringKeyword),
            this.languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(className).toLowerCase()),
            [this.languageDefinition.staticKeyword]);

        const methods = [
            this.createCreateTableMethod(fields),
            this.createReadFromDbMethod(fields),
            this.createInsertOrUpdateMethod(fields),
            this.createBatchInsertOrUpdateMethod(),
            this.createDeleteMethod(),
            this.createReadListFromDbMethod(fields),
            this.createSelectMethod(fields),
            this.createSelectAllMethod(),
            this.createSelectByIdMethod(),
            ...this.createMethodsBasedOnDependencies(fields),
        ];

        const properties = this.getAllProperties(tableNameString, fields);

        const packageString = classSettings.package;

        let tableClass = null;
        
        if (this.languageDefinition.name === Languages.KOTLIN) {
            tableClass = new KotlinClassDefinition(packageString, this.className.name, properties, null, methods, null, dependencies);
        } else {
            tableClass = new ClassDefinition(packageString, this.className.name, properties, null, methods, null, dependencies);
        }

        tableClass.inheritsFrom = inherits;
        tableClass.implements = implementsInterfaces;
        return tableClass;
    }

    getAllProperties(tableNameString: PropertyDefinition, fields: Array<DatabaseFieldHelper>): Array<PropertyDefinition> {
        const properties = [tableNameString, ...fields.filter((field) => {
            return !field.fromClass && field.fieldName;
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
            if (subProperties) {
                const propertiesFromClass = subProperties.map((subProperty) => {
                    const prefix = property.name;
                    subObject = new DatabaseFieldHelper(
                        this.databaseLanguageDefinition,
                        this.languageDefinition,
                        subProperty.name,
                        ModelClassParser.getPropertyType(this.languageDefinition, subProperty.type, subProperty.required),
                        subProperty.required, null);
                    subObject.fieldName = `${prefix.toUpperCase()}_${subObject.fieldName}`;
                    subObject.databaseFieldName = `${prefix}_${subObject.databaseFieldName}`;
                    subObject.fromClass = property.name;
                    return subObject;
                });

                return new DatabaseFieldHelper(this.databaseLanguageDefinition,
                    this.languageDefinition,
                    property.name,
                    ModelClassParser.getPropertyType(this.languageDefinition, property.type, property.required),
                    property.required,
                    propertiesFromClass);
            }

            return new DatabaseFieldHelper(this.databaseLanguageDefinition, this.languageDefinition,
                property.name,
                ModelClassParser.getPropertyType(this.languageDefinition, property.type, property.required),
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
            const fieldName = new PropertyDefinition(field.fieldName, new TypeDefinition(this.languageDefinition.stringKeyword));
            return `\t\t${this.languageDefinition.callProperty(this.className, fieldName, false)}`;
        });

        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const propertyCall = this.languageDefinition.callProperty(this.className, fieldName, false);
        const tablePlusParameters = [propertyCall, ...parameters];
        
        const tableString = this.languageDefinition.stringDeclaration(`${this.databaseLanguageDefinition.createTable} \`${this.languageDefinition.stringReplacement}\` (
${databaseFields}
\t\t\t)`);
        const methodCall = `${this.languageDefinition.methodCall(new PropertyDefinition(tableString, new TypeDefinition(this.languageDefinition.stringKeyword)), 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'execSQL', [methodCall])};`;

        return new MethodDefinition('createTable',
            null,
            [
                DatabaseTableSchemaClassParser.databaseObject
            ],
            methodString);
    }

    classNameToVar(className: string): string {
        return className.substr(0, 1).toLowerCase() + className.substr(1);
    }

    varNameToClass(className: string): string {
        return className.substr(0, 1).toUpperCase() + className.substr(1);
    }

    readFromDatabaseAccordingToFieldType(className: string, field: DatabaseFieldHelper) {
        const fieldName = new PropertyDefinition(field.fieldName, new TypeDefinition(this.languageDefinition.stringKeyword));
        const columnName = new PropertyDefinition(this.languageDefinition.callProperty(this.className, fieldName, false), new TypeDefinition(this.languageDefinition.stringKeyword));
        const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName.name]);

        switch(field.databaseType.name) {
            case this.databaseLanguageDefinition.numberKeyword:
                return this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getDouble', [methodGetIndexOfColumn]);
            case this.databaseLanguageDefinition.stringKeyword:
                const method = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
                if (field.type.isEnum) {
                    const classNameProperty = new PropertyDefinition(className, new TypeDefinition(className));
                    const fieldType = new PropertyDefinition(field.type.name, new TypeDefinition(this.languageDefinition.stringKeyword));
                    const caller = new PropertyDefinition(this.languageDefinition.callProperty(classNameProperty, fieldType, false), new TypeDefinition(this.languageDefinition.stringKeyword));
                    return this.languageDefinition.methodCall(caller, 'valueOf', [method]);
                }
                return method;

            case this.databaseLanguageDefinition.integerKeyword:
            case this.databaseLanguageDefinition.booleanKeyword:
                if (field.type.name === this.languageDefinition.booleanKeyword) {
                    const variable = new PropertyDefinition(this.languageDefinition.methodCall(
                        DatabaseTableSchemaClassParser.cursor, 'getInt', [methodGetIndexOfColumn]), 
                        new TypeDefinition(this.languageDefinition.stringKeyword));
                    return this.languageDefinition.simpleComparison(
                        variable,
                        new PropertyDefinition('1', new TypeDefinition(this.languageDefinition.stringKeyword)),
                        false);
                }
                return this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getInt',  [methodGetIndexOfColumn]);
            default:
                // throw new Error(`QUE? ${JSON.stringify(field)}`);
                return null;
        }
    }

    createReadFromDbMethod(fields: Array<DatabaseFieldHelper>) {
        const className = this.definition.name;
        const varName = this.classNameToVar(className);

        const parameters = fields.map((field) => {
            const nonNative = this.handleNonNativeTypes(field);
            if (nonNative) {
                return nonNative;
            }

            return this.readFromDatabaseAccordingToFieldType(className, field);
        });

        let methodString = `\t\t${this.languageDefinition.variableDeclaration(this.languageDefinition.constKeyword, 
            new TypeDefinition(className), 
            varName, 
            this.languageDefinition.constructObject(new TypeDefinition(className), parameters))}`;
        methodString += `\n\t\t${this.languageDefinition.returnDeclaration(varName)}`;

        const parametersOfMethod: Array<ParameterDefinition> = [];
        if (this.isReferencingOtherTables(fields)) {
            parametersOfMethod.push(DatabaseTableSchemaClassParser.databaseObject);
        }
        parametersOfMethod.push(ParameterDefinition.fromProperty(DatabaseTableSchemaClassParser.cursor));

        return new MethodDefinition('readFromDb', 
            new TypeDefinition(className),
            parametersOfMethod,
            methodString);
    }

    isReferencingOtherTables(fields: Array<DatabaseFieldHelper>) {
        return fields.filter((field) => {
            return field.searchByDependencyId || field.searchById;
        }).length > 0;
    }

    handleNonNativeTypes(field: DatabaseFieldHelper) {
        const className = this.definition.name;
        if (field.fromClass) {
            const params = field.fromClass.map((field) => {
                return this.readFromDatabaseAccordingToFieldType(className, field);
            });

            return this.languageDefinition.constructObject(field.type, params);
        }
        const fieldName = new PropertyDefinition(field.fieldName, new TypeDefinition(this.languageDefinition.stringKeyword));
        const columnName = this.languageDefinition.callProperty(this.className, fieldName, false);
        const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName]);
        if (field.searchByDependencyId) {
            const constructObject = new PropertyDefinition(
                this.languageDefinition.constructObject(new TypeDefinition(`${field.type.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name)
            );
            let getId = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectById`, ['db', getId])}`;
        }
        if (field.searchById) {
            const constructObject = new PropertyDefinition(this.languageDefinition.constructObject(
                new TypeDefinition(`${field.type.subtype.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name));

            const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
            const columnName = this.languageDefinition.callProperty(this.className, fieldName, false);

            const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName]);
            let getId = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectBy${className}Id`, ['db', getId])}`;
        }
        if (field.isArrayOfString) {
            const callCursorGetStringMethod = new PropertyDefinition(
                this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]), 
                new TypeDefinition(this.languageDefinition.stringKeyword));
                
            const splitMethod = new PropertyDefinition(this.languageDefinition.methodCall(
                callCursorGetStringMethod, 
                'split', [this.languageDefinition.stringDeclaration(DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR)]
            ), new TypeDefinition(this.languageDefinition.stringKeyword));
            return this.languageDefinition.methodCall(splitMethod, 'toTypedArray', null);
        }
        return null;
    }

    createInsertOrUpdateMethodWithConvenienceMethod(fields: Array<DatabaseFieldHelper>) {
        const className = this.definition.name;

        const objectName = this.classNameToVar(className);

        const { onlyNativeTypes, nonNativeTypes } = this.getFieldsSeparatedByNative(fields)
        
        const values = new PropertyDefinition('values', new TypeDefinition('ContentValues'));
        const valuesVariable = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            values.type, 
            values.name, 
            this.languageDefinition.constructObject(values.type, null));

        const onlyNativeTypesNames = onlyNativeTypes.map((field: DatabaseFieldHelper) => {
            let name = '';
            let propertyName = field.propertyName;
            if (field.fromClass) {
                propertyName = `${field.fromClass}.${propertyName}`;
            }
            if (field.type.isEnum) {
                name = '.name';
                if (field.type.nullable) {
                    name = `!!${name}`;
                }
            } else if (!field.type.isNative && field.searchByDependencyId) {
                if (field.type.nullable) {
                    propertyName += '?';
                }
                propertyName += '.id';
            } else if (field.isArrayOfString) {
                if (field.type.nullable) {
                    propertyName = `${propertyName}!!`;
                }

                propertyName = this.languageDefinition.methodCall(
                    new PropertyDefinition(propertyName, new TypeDefinition(this.languageDefinition.stringKeyword)),
                    this.languageDefinition.joinMethod, 
                    [this.languageDefinition.stringDeclaration(`${DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR}`)]);
            }
            const fieldName = new PropertyDefinition(field.fieldName, new TypeDefinition(this.languageDefinition.stringKeyword));
            const method = this.languageDefinition.methodCall(
                values, 
                'put', 
                [
                    this.languageDefinition.callProperty(this.className, fieldName, false), 
                    `${objectName}.${propertyName}${name}`
                ]);

            if (field.type.nullable && (field.isArrayOfString || field.type.isEnum)) {
                return `\t\t${this.languageDefinition.ifNotNullStatement(`${objectName}.${field.propertyName}`, method)}`;
            } else {
                return `\t\t${method}`;
            }
        }).join('\n');

        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.className, fieldName, false);
        const callExecSqlMethod = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'insertWithOnConflict', [ tableName, this.languageDefinition.nullKeyword, 'values', 'SQLiteDatabase.CONFLICT_REPLACE']);
        let methodString = `\t\t${valuesVariable}\n`;
        methodString += `${onlyNativeTypesNames}\n`;

        if (nonNativeTypes.length > 0) {
            methodString += `\n${this.getInsertMethodForNonNativeTypes(nonNativeTypes, objectName)}\n\n`;
        }

        methodString += `\t\t${this.languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(this.languageDefinition.longKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(objectName, new TypeDefinition(`${className}`))
            ],
            methodString);
    }

    createInsertOrUpdateMethod(fields: Array<DatabaseFieldHelper>) {
        if (this.languageDefinition.hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase) {
            return this.createInsertOrUpdateMethodWithConvenienceMethod(fields);
        }
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
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        
        const statement = `${this.languageDefinition.methodCall(sqlStringVariable, 'format', this.getFields(onlyNativeTypes, objectName))}`;
        
        const callExecSqlMethod = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'execSQL', [statement]);

        let methodString = `\t\t${this.languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        if (nonNativeTypes.length > 0) {
            methodString += `\n${this.getInsertMethodForNonNativeTypes(nonNativeTypes, objectName)}`;
        }

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(`${objectName}`, new TypeDefinition(`${className}`))
            ],
            methodString);
    }

    getInsertMethodForNonNativeTypes(nonNativeTypes: Array<DatabaseFieldHelper>, objectName: string) {
        return nonNativeTypes.filter((property) => {
            return property.type.subtype != null;
        }).map((property) => {
            let methodName = 'insertOrUpdate';
            if (property.type.name.indexOf(this.languageDefinition.arrayKeyword) > -1) {
                methodName = 'batchInsertOrUpdate';
            }

            const constructObject = new PropertyDefinition(
                this.languageDefinition.constructObject(
                    new TypeDefinition(`${property.type.subtype.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name)
            );

            const callMethod = this.languageDefinition.methodCall(constructObject, methodName, ['db', `${objectName}.${property.propertyName}`]);
            if (property.type.nullable) {
                const callMethod = this.languageDefinition.methodCall(constructObject, methodName, ['db', `${objectName}.${property.propertyName}!!`]);
                return `\t\t${this.languageDefinition.ifNotNullStatement(`${objectName}.${property.propertyName}`, callMethod)}`;
            } else {
                return `\t\t${callMethod}`;
            }
        }).join('\n');
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
        let fields = [`${this.className}.${DatabaseTableSchemaClassParser.tableNameProperty}`];
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            return `${this.thisKeyword}.${property.fieldName}`;
        }));
        
        fields = fields.concat(properties.filter((property) => {
            return property.databaseFieldName !== 'id';
        }).map((property) => {
            if (property.isArrayOfString) {
                const caller = new PropertyDefinition(objectName, new TypeDefinition(this.languageDefinition.stringKeyword));
                const propertyName = new PropertyDefinition(property.propertyName, new TypeDefinition(this.languageDefinition.stringKeyword));
                const callProperty = new PropertyDefinition(this.languageDefinition.callProperty(caller, propertyName, false), new TypeDefinition(this.languageDefinition.stringKeyword));
                return `${this.languageDefinition.methodCall(callProperty, 'join', 
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
        const objectName = `${this.classNameToVar(className)}Array`;

        const callInsertOrUpdateMethod = this.languageDefinition.methodCall(this.thisKeyword, 'insertOrUpdate', ['db', objectName]);

        let mapBodyString = callInsertOrUpdateMethod;
        if (this.languageDefinition.lambdaMethodsMustCallReturn) {
            mapBodyString = `${this.languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        }

        const callMapMethod = this.languageDefinition.lambdaMethod(objectName, 'map', objectName, mapBodyString);
        const mapMethodProperty = new PropertyDefinition(callMapMethod, new TypeDefinition(this.languageDefinition.stringKeyword));
        const convertMap = this.languageDefinition.methodCall(mapMethodProperty, 'toTypedArray', null);
        const methodString = `\t\t${this.languageDefinition.returnDeclaration(convertMap)}`;

        return new MethodDefinition('batchInsertOrUpdate',
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.languageDefinition.longKeyword)),
            [
                DatabaseTableSchemaClassParser.databaseObject, 
                new ParameterDefinition(objectName, new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(className))),
            ],
            methodString);
    }

    createDeleteMethodWithConvenienceMethod() {
        const id = new PropertyDefinition('id', new TypeDefinition(this.languageDefinition.stringKeyword))
        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.className, fieldName, false);
        
        const dbExecCall = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'delete', 
            [tableName, this.languageDefinition.stringDeclaration(`${this.className}.ID_FIELD = ?`), 
            this.languageDefinition.methodCall(null, 'arrayOf', [this.languageDefinition.methodCall(id, 'toString', null)])]);
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;
        return new MethodDefinition('deleteById',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject, 
                ParameterDefinition.fromProperty(id),
            ],
            returnCall);
    }

    createDeleteMethod() {
        if (this.languageDefinition.hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase) {
            return this.createDeleteMethodWithConvenienceMethod();
        }
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.deleteKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} = ${this.databaseLanguageDefinition.parameterKeyword}`
        );
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        const formatMethodCall = this.languageDefinition.methodCall(sqlStringVariable, 'format', 
            [`${this.className}.${DatabaseTableSchemaClassParser.tableNameProperty}`, `${this.className}.ID_FIELD`]);

        const dbExecCall = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'execSQL', [formatMethodCall, 'id']);
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;
        return new MethodDefinition('deleteById',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject, 
                new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.intKeyword)),
            ],
            returnCall);
    }

    createReadListFromDbMethod(fields: Array<DatabaseFieldHelper>) {
        const listDeclaration = this.createListObject();

        const params = [];
        const paramsOfMethod = [];
        if (this.isReferencingOtherTables(fields)) {
            paramsOfMethod.push(DatabaseTableSchemaClassParser.databaseObject);
            params.push(DatabaseTableSchemaClassParser.databaseObject.name);
        }
        params.push('cursor');
        paramsOfMethod.push(ParameterDefinition.fromProperty(DatabaseTableSchemaClassParser.cursor));

        const cursorMoveToNext = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'moveToNext', null);
        const readFromDbMethodCall = this.languageDefinition.methodCall(this.thisKeyword, 'readFromDb', params);

        const list = new PropertyDefinition('list', new TypeDefinition(this.languageDefinition.arrayListKeyword, false, new TypeDefinition(this.definition.name)),);

        const whileBody = `\t\t${this.languageDefinition.methodCall(list, 'add', [readFromDbMethodCall])}`;
        const whileStatement = this.languageDefinition.whileStatement(cursorMoveToNext, whileBody);
        const returnCall = `${this.languageDefinition.returnDeclaration(this.languageDefinition.methodCall(list, 'toTypedArray', null))}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${whileStatement}
\t\t${returnCall}`
        return new MethodDefinition('readListFromDb', 
            new TypeDefinition(this.languageDefinition.arrayKeyword, false, new TypeDefinition(this.definition.name)),
            paramsOfMethod,
            methodBody);
    }

    createListObject(): string {
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

    createSelectMethod(fields: Array<DatabaseFieldHelper>) {
        const cursorDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.variableKeyword,
            new TypeDefinition(DatabaseTableSchemaClassParser.cursor.type.name, false, null, false, true),
            DatabaseTableSchemaClassParser.cursor.name,
            this.languageDefinition.nullKeyword);

        const listDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.variableKeyword, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, false, new TypeDefinition(this.definition.name, false, null, false), false, true), 
            'list',
            this.languageDefinition.nullKeyword);

        const errorDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.variableKeyword, 
            new TypeDefinition('Throwable', false, null, false, true), 'error', this.languageDefinition.nullKeyword);

        const dbExecCall = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'rawQuery', ['sql', 'args']);
        const assignRawQueryToCursor = this.languageDefinition.assignment(DatabaseTableSchemaClassParser.cursor.name, dbExecCall);

        const params = [];
        if (this.isReferencingOtherTables(fields)) {
            params.push(DatabaseTableSchemaClassParser.databaseObject.name);
        }
        params.push(DatabaseTableSchemaClassParser.cursor.name);
        const callReadListFromDbMethod = this.languageDefinition.methodCall(this.thisKeyword, 'readListFromDb', params);
        const assignList = this.languageDefinition.assignment('list', callReadListFromDbMethod);
        const tryBody = `\t\t${assignRawQueryToCursor}
\t\t\t${assignList}`;
        const catchBody = `\t\t${this.languageDefinition.assignment('error', 'e')}`;
        const cursor = new PropertyDefinition(DatabaseTableSchemaClassParser.cursor.name, 
            new TypeDefinition(DatabaseTableSchemaClassParser.cursor.type.name, false, null, false, true));
        const finallyBody = `\t\t${this.languageDefinition.methodCall(cursor, 'close', null)}
\t\t\t${this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'close', null)}`;
        const tryCatch = this.languageDefinition.tryCatchStatement(tryBody, catchBody, finallyBody);

        const ifError = this.languageDefinition.ifNotNullStatement('error', 'throw error');

        const returnCall = this.languageDefinition.returnDeclaration('list!!');

        const methodBody = `\t\t${listDeclaration}
\t\t${cursorDeclaration}
\t\t${errorDeclaration}
${tryCatch}
\t\t${ifError}
\t\t${returnCall}`;

        return new MethodDefinition('select', 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('sql', new TypeDefinition(this.languageDefinition.stringKeyword)),
                new ParameterDefinition('args', new TypeDefinition(this.languageDefinition.stringKeyword), null, [this.languageDefinition.varargsKeyword]),
            ],
            methodBody);
    }

    createSelectAllMethod() {
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`
        );
        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.className, fieldName, false);
        
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        const formatMethodCall = this.languageDefinition.methodCall(sqlStringVariable, 'format', [tableName]);

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 'select', [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall]);
        
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition('selectAll', 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
            ],
            returnCall);
    }

    createSelectByIdMethod() {
        const sql = this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} = ${this.databaseLanguageDefinition.parameterKeyword}`
        );
        
        const fieldForTableName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.className, fieldForTableName, false);

        const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableNameForField = this.languageDefinition.callProperty(this.className, fieldName, false);
        
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        const formatMethodCall = this.languageDefinition.methodCall(sqlStringVariable, 'format', [tableName, tableNameForField]);

        const idParam = new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.stringKeyword));

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 'select', [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall, this.languageDefinition.methodCall(idParam, 'toString', null)]);

        const listDeclaration = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, false, new TypeDefinition(this.definition.name)),
            'list', dbExecCall);

        const returnCall = `${this.languageDefinition.returnDeclaration('list[0]')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${returnCall}`;

        return new MethodDefinition('selectById',
            new TypeDefinition(this.definition.name),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                idParam,
            ],
            methodBody);
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
            var hash = JSON.stringify(method.valueOf());
            var isDup = dups[hash];
            dups[hash] = true;
            return !isDup;
        });
    }

    createMethodToSelectOneToN() {
        const methodName = `selectAllIdsInList`;
        let sql = `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`;

        let returnInterrogation = this.languageDefinition.stringDeclaration('?');
        if (this.languageDefinition.lambdaMethodsMustCallReturn) {
            returnInterrogation = this.languageDefinition.returnDeclaration(this.languageDefinition.stringDeclaration('?'));
        }
        const interrogations = new PropertyDefinition(this.languageDefinition.lambdaMethod('ids', 'map', null, returnInterrogation), new TypeDefinition(this.languageDefinition.stringKeyword));
        const interrogationsJoined = this.languageDefinition.methodCall(interrogations, this.languageDefinition.joinMethod, [this.languageDefinition.stringDeclaration(', ')]);
        const interrogationsVar = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            new TypeDefinition(this.languageDefinition.stringKeyword),
            'interrogations',
            interrogationsJoined);
        sql += ` ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} ${this.databaseLanguageDefinition.inKeyword} (${this.languageDefinition.stringReplacement})`;
        sql = this.languageDefinition.stringDeclaration(sql);
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        
        const fieldForTableName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.className, fieldForTableName, false);

        const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableNameForField = this.languageDefinition.callProperty(this.className, fieldName, false);
        
        const formatMethodCall = this.languageDefinition.methodCall(sqlStringVariable, 'format', 
            [tableName, tableNameForField, 'interrogations']);

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 'select', [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall, '*ids']);
        
        const returnCall = `\t\t${interrogationsVar}\n\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('ids', new TypeDefinition(this.languageDefinition.arrayKeyword, false, new TypeDefinition(this.languageDefinition.stringKeyword))),
            ],
            returnCall);
    }

    createMethodToSelectNToOne(reference: DefinitionReferenceHelper, fieldReference: DatabaseFieldHelper) {
        const methodName = `selectBy${reference.definition.name}Id`;
        let sql = `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`;
        sql += ` ${this.databaseLanguageDefinition.whereKeyword} ${fieldReference.databaseFieldName} = ${this.databaseLanguageDefinition.parameterKeyword}`;

        const sqlVariable = new PropertyDefinition(this.languageDefinition.stringDeclaration(sql), new TypeDefinition(this.languageDefinition.stringKeyword));

        const fieldForTableName = new PropertyDefinition(`${reference.definition.name}${DatabaseTableSchemaClassParser.classSufix}`,
            new TypeDefinition(this.languageDefinition.stringKeyword));
        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, 
            new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(fieldForTableName, fieldName, false);

        const formatMethodCall = this.languageDefinition.methodCall(sqlVariable, 'format', [tableName]);

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 
            'select',
            [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall]);
        
        const returnCall = `\t\t${this.languageDefinition.returnDeclaration(dbExecCall)}`;

        return new MethodDefinition(methodName, 
            new TypeDefinition(this.languageDefinition.arrayKeyword, true, new TypeDefinition(this.definition.name)),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.stringKeyword)),
            ],
            returnCall);
    }
}

class DatabaseFieldHelper {
    static FIELD_SUFIX = '_FIELD';
    static ID = 'ID';

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

        if (this.type.subtype && this.type.isEnum) {
            this.databaseType = new DatabaseTypeHelper(this.type.subtype, languageDefinition, databaseLanguageDefinition);
        }
        if (this.type.subtype && !this.type.subtype.isNative) { // Is an array of other model
            this.searchById = true;
            this.searchByDependencyId = false;
            this.fieldName = null;
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
            new TypeDefinition(this.languageDefinition.stringKeyword, true, null, false, !this.required),
            this.languageDefinition.stringDeclaration(this.databaseFieldName),
            [this.languageDefinition.staticKeyword]);
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
        } else if (type.name === languageDefinition.intKeyword) {
            this.name = databaseLanguageDefinition.integerKeyword;
        } else if (type.name === languageDefinition.booleanKeyword) {
            this.name = databaseLanguageDefinition.booleanKeyword;
        } else {
            this.name = null;
        }
    }
}