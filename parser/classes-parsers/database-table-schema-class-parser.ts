import LanguageDefinition from "../../languages/language-definition";
import SqliteLanguageDefinition from "../../languages/sqlite-language-definition";
import { DefinitionHelper, DefinitionReferenceHelper, RelationshipType, DefinitionPropertyHelper, DefinitionTypeHelper } from "../yaml-definition-to-definition-helper-converter";
import ParameterDefinition from "../definitions/parameter-definition";
import TypeDefinition from "../definitions/type-definition";
import PropertyDefinition from "../definitions/property-definition";
import StringUtils from "../../string-utils";
import ClassDefinition from "../definitions/class-definition";
import MethodDefinition from "../definitions/method-definition";
import Parser from "../parser-interface";
import { LanguageSettings, TypeOfClass } from "../../configuration";
import Languages from "../../languages/languages";
import KotlinClassDefinition from "../definitions/kotlin-class-definition";
import { YamlType } from "../swagger-objects-representation/definition";
import ArrayUtils from "../../array-utils";

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
        const className = this.definition.name;
        this.className = new PropertyDefinition(`${className}${DatabaseTableSchemaClassParser.classSufix}`, new TypeDefinition(this.definition.name));

        const classSettings = this.configuration.getClassSettings(TypeOfClass.DATABASE_CLASSES);

        let inherits = null;
        if (classSettings.inheritsFrom) {
            inherits = TypeDefinition.typeBySplittingPackageAndName(classSettings.inheritsFrom, className);
        }
        const implementsInterfaces = classSettings.implementsInterfaces.map((interfaceString) => {
            return TypeDefinition.typeBySplittingPackageAndName(interfaceString, className);
        });

        const dependencies = this.getDependencies(inherits, implementsInterfaces);
        
        let tableNameString = new PropertyDefinition(
            DatabaseTableSchemaClassParser.tableNameProperty,
            new TypeDefinition(this.languageDefinition.stringKeyword),
            this.languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(className).toLowerCase()),
            [this.languageDefinition.staticKeyword, this.languageDefinition.staticConstKeyword]);

        const methods = [
            this.createCreateTableMethod(this.definition.properties),
            this.createReadFromDbMethod(this.definition.properties),
            this.createInsertOrUpdateMethod(this.definition.properties),
            this.createBatchInsertOrUpdateMethod(),
            this.createDeleteMethod(),
            this.createReadListFromDbMethod(this.definition.properties),
            this.createSelectMethod(this.definition.properties),
            this.createSelectAllMethod(),
            this.createSelectByIdMethod(),
            ...this.createMethodsBasedOnDependencies(this.definition.properties),
        ];

        const properties = [tableNameString, ...this.getAllProperties(this.definition.properties).map((property) => {
            return DatabaseFieldHelper.toProperty(property, this.languageDefinition); 
        })];

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

    getClassNameForStaticConsts(): PropertyDefinition {
        if (this.languageDefinition.shouldInsertClassNameForStaticConstsInTheSameClass) {
            return this.className;
        } else {
            return null;
        }
    }

    getDependencies(inherits: TypeDefinition, implementsInterfaces: Array<TypeDefinition>) {
        const nativeDependencies = [
            'android.database.sqlite.SQLiteDatabase',
            'android.database.Cursor',
            'android.content.ContentValues',
        ];        
        const parsedDependencies = this.parseDependencies(this.definition);
        return [
            ...nativeDependencies, 
            `${this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES).package}.${this.definition.name}`,
            ...parsedDependencies,
            inherits ? inherits.package : null,
            ...implementsInterfaces.map((interfaceType) => {
                return interfaceType.package;
            })
        ].filter((dependency) => {
            return dependency !== null;
        });
    }

    parseDependencies(definition: DefinitionHelper): Array<string> {
        const modelClassSettings = this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES);

        const dependencies = [];
        definition.references.forEach((reference) => {
            dependencies.push(`${modelClassSettings.package}.${reference.definition.name}`);
            if (reference.definition.references) {
                this.parseDependencies(reference.definition).forEach((dependency) => {
                    dependencies.push(dependency);
                });
            }
        });
        return ArrayUtils.removeDuplicates(dependencies.filter((dependency) => {
            return dependency != null;
        }));
    }

    getAllProperties(properties: Array<DefinitionPropertyHelper>): Array<DefinitionPropertyHelper> {
        const props = properties.filter((property) => {
            return property.type.isNative || property.type.isEnum || DatabaseFieldHelper.isArrayOfString(property.type);
        });

        properties.filter((property) => {
            return !property.type.isNative && !property.type.isEnum;
        }).forEach((property) => {
            const definition = property.refersTo && property.refersTo.definition;
            if (definition) {
                if (property.refersTo.relationship === RelationshipType.ONE_TO_ONE && !definition.needsTable) {
                    this.getAllProperties(definition.properties).forEach((innerProperty) => {
                        if (!innerProperty.refersTo) {
                            innerProperty.refersTo = new DefinitionReferenceHelper(definition, property, null);
                        } else {
                            innerProperty.refersTo.property = property;
                        }
                        props.push(innerProperty);
                    });
                } else if (property.refersTo.relationship === RelationshipType.ONE_TO_ONE || 
                        property.refersTo.relationship === RelationshipType.ONE_TO_N) {
                    props.push(property);
                }
            }
        });
        return props.filter((property) => {
            return property != null;
        });
    }

    createCreateTableMethod(properties: Array<DefinitionPropertyHelper>) {
        const fields = this.getAllProperties(properties);
        const databaseFields = fields.map((property) => {
            const properties = DatabaseFieldHelper.getDatabaseFieldProperties(property, this.databaseLanguageDefinition);

            let fieldString = `\t\t\t\t\`${this.languageDefinition.stringReplacement}\` ${DatabaseFieldHelper.getDatabaseType(property.type, this.databaseLanguageDefinition)}`;
            if (properties) {
                fieldString += ` ${properties}`;
            }
            return fieldString;
        }).join(',\n');

        const parameters = fields.map((field) => {
            const fieldName = new PropertyDefinition(DatabaseFieldHelper.getFieldNameForProperty(field), new TypeDefinition(this.languageDefinition.stringKeyword));
            return `\t\t${this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false)}`;
        });

        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const propertyCall = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        const tablePlusParameters = [propertyCall, ...parameters];
        
        const tableString = this.languageDefinition.stringDeclaration(`${this.databaseLanguageDefinition.createTable} \`${this.languageDefinition.stringReplacement}\` (
${databaseFields}
\t\t\t)`);
        const methodCall = `${this.languageDefinition.methodCall(new PropertyDefinition(tableString, new TypeDefinition(this.languageDefinition.stringKeyword)), 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'execSQL', [methodCall])}`;

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

    createReadFromDbMethod(fields: Array<DefinitionPropertyHelper>) {
        const className = this.definition.name;
        const varName = this.classNameToVar(className);

        const parameters = fields.map((field) => {
            const native = this.readFromDatabaseAccordingToFieldType(className, field);
            if (native) {
                return native;
            }
            return this.readNonNativeTypesFromDatabase(field);
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

    isReferencingOtherTables(fields: Array<DefinitionPropertyHelper>) {
        return fields.filter((field) => {
            return !field.type.isNative && field.refersTo && field.refersTo.definition && field.refersTo.definition.needsTable;
        }).length > 0;
    }

    readFromDatabaseAccordingToFieldType(className: string, field: DefinitionPropertyHelper): string {
        const fieldName = new PropertyDefinition(DatabaseFieldHelper.getFieldNameForProperty(field), new TypeDefinition(this.languageDefinition.stringKeyword));
        const columnName = new PropertyDefinition(this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false), new TypeDefinition(this.languageDefinition.stringKeyword));
        const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName.name]);

        let typeName = field.type.name;
        if (field.enum) {
            typeName = YamlType.TYPE_STRING;
        }

        switch(typeName) {
            case YamlType.TYPE_NUMBER:
                return this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getDouble', [methodGetIndexOfColumn]);
            case YamlType.TYPE_STRING:
                const method = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
                if (field.type.isEnum) {
                    const classNameProperty = new PropertyDefinition(className, new TypeDefinition(className));
                    const fieldType = new PropertyDefinition(field.type.name, new TypeDefinition(this.languageDefinition.stringKeyword));
                    const caller = new PropertyDefinition(this.languageDefinition.callProperty(classNameProperty, fieldType, false), new TypeDefinition(this.languageDefinition.stringKeyword));
                    return this.languageDefinition.methodCall(caller, 'valueOf', [method]);
                }
                return method;
            case YamlType.TYPE_BOOLEAN:
                const variable = new PropertyDefinition(this.languageDefinition.methodCall(
                    DatabaseTableSchemaClassParser.cursor, 'getInt', [methodGetIndexOfColumn]), 
                    new TypeDefinition(this.languageDefinition.stringKeyword));
                return this.languageDefinition.simpleComparison(
                    variable,
                    new PropertyDefinition('1', new TypeDefinition(this.languageDefinition.stringKeyword)),
                    false);
            case YamlType.TYPE_INTEGER:
                return this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getInt',  [methodGetIndexOfColumn]);
            default:
                // throw new Error(`QUE? ${JSON.stringify(field)}`);
                return null;
        }
    }

    readNonNativeTypesFromDatabase(field: DefinitionPropertyHelper): string {
        const className = this.definition.name;
        if (field.refersTo && (field.refersTo.relationship === null || field.refersTo.relationship === RelationshipType.ONE_TO_ONE)) {
            if (!field.refersTo.definition.needsTable) {
                const params = field.refersTo.definition.properties.map((field) => {
                    const native = this.readFromDatabaseAccordingToFieldType(className, field);
                    if (native) {
                        return native;
                    }
                    return this.readNonNativeTypesFromDatabase(field);
                });

                return this.languageDefinition.constructObject(DefinitionTypeHelper.toTypeDefinition(field.type, field.required, this.languageDefinition), params);
            }
        }

        const fieldName = new PropertyDefinition(DatabaseFieldHelper.getFieldNameForProperty(field), new TypeDefinition(this.languageDefinition.stringKeyword));
        const columnName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName]);

        const otherDefinition = field.refersTo && field.refersTo.definition;
        if (otherDefinition && field.refersTo.relationship === RelationshipType.ONE_TO_ONE) {
            const constructObject = new PropertyDefinition(
                this.languageDefinition.constructObject(new TypeDefinition(`${field.type.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name)
            );
            let getId = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectById`, ['db', getId])}`;
        }
        if (otherDefinition && field.refersTo.relationship === RelationshipType.N_TO_ONE) {
            const constructObject = new PropertyDefinition(this.languageDefinition.constructObject(
                new TypeDefinition(`${field.type.subType.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name));

            const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
            const columnName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);

            const methodGetIndexOfColumn = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getColumnIndex', [columnName]);
            let getId = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]);
            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectBy${className}Id`, ['db', getId])}`;
        }

        const callCursorGetStringMethod = new PropertyDefinition(
            this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.cursor, 'getString', [methodGetIndexOfColumn]), 
            new TypeDefinition(this.languageDefinition.stringKeyword));
            
        const splitMethod = new PropertyDefinition(this.languageDefinition.methodCall(
            callCursorGetStringMethod, 
            'split', [this.languageDefinition.stringDeclaration(DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR)]
        ), new TypeDefinition(this.languageDefinition.stringKeyword));
        const typedArray = this.languageDefinition.methodCall(splitMethod, 'toTypedArray', null);
        if (DatabaseFieldHelper.isArrayOfString(field.type)) {
            return typedArray;
        }
        if (otherDefinition && field.refersTo.relationship === RelationshipType.ONE_TO_N) {
            const constructObject = new PropertyDefinition(this.languageDefinition.constructObject(
                new TypeDefinition(`${field.type.subType.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name));

            return `${this.languageDefinition.methodCall(
                constructObject, 
                `selectAllIdsInList`, ['db', typedArray])}`;
        }
        return null;
    }

    createInsertOrUpdateMethodWithConvenienceMethod(fields: Array<DefinitionPropertyHelper>) {
        const values = new PropertyDefinition('values', new TypeDefinition('ContentValues'));
        const className = this.definition.name;
        const objectName = this.classNameToVar(className);

        const onlyNativeTypes = fields.filter((property) => {
            return !property.type.isArray() || DatabaseFieldHelper.isArrayOfString(property.type);
        });

        const onlyNativeTypesNames = this.getFieldNameAndPropertyNameToBeCalled(onlyNativeTypes.map((field) => {
            return {
                key: DatabaseFieldHelper.getFieldNameForProperty(field),
                value: objectName,
                field: field,
                required: true
            }
        }));
        
        const contentValues = onlyNativeTypesNames.map((entry) => {
            const fieldName = new PropertyDefinition(entry.key, new TypeDefinition(this.languageDefinition.stringKeyword));
            const method = this.languageDefinition.methodCall(
                values, 
                'put', 
                [
                    this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false), 
                    `${entry.value}`
                ]);
            const field = entry.field;
            if (!field.required && (DatabaseFieldHelper.isArrayOfString(field.type) || field.type.isEnum)) {
                return `\t\t${this.languageDefinition.ifNotNullStatement(`${objectName}.${field.name}`, method)}`;
            } else {
                return `\t\t${method}`;
            }
        }).join('\n');

        const valuesVariable = this.languageDefinition.variableDeclaration(
            this.languageDefinition.constKeyword, 
            values.type, 
            values.name, 
            this.languageDefinition.constructObject(values.type, null));

        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        const callExecSqlMethod = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'insertWithOnConflict', [ tableName, this.languageDefinition.nullKeyword, 'values', 'SQLiteDatabase.CONFLICT_REPLACE']);
        let methodString = `\t\t${valuesVariable}\n`;
        methodString += `${contentValues}\n`;

        methodString += this.getInsertMethodForNonNativeTypes(fields, objectName);

        methodString += `\t\t${this.languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(this.languageDefinition.longKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(objectName, new TypeDefinition(`${className}`))
            ],
            methodString);
    }

    private getFieldNameAndPropertyNameToBeCalled(fields: Array<any>): Array<any> {
        const processedFields = []
        fields.forEach((entry) => {
            const reference = entry.field.refersTo;
            if (reference && reference.relationship !== null && !reference.definition.needsTable) {
                const entries = reference.definition.properties.map((property) => {
                    return {
                        key: DatabaseFieldHelper.getFieldNameForProperty(property),
                        value: this.getPropertyNameToBeCalled(entry.value, entry.required, entry.field),
                        field: property,
                        required: entry.required && property.required
                    };
                });
                this.getFieldNameAndPropertyNameToBeCalled(entries).map((entry) => {
                    processedFields.push(entry);
                });
            } else {
                processedFields.push({
                    key: DatabaseFieldHelper.getFieldNameForProperty(entry.field),
                    value: this.getPropertyNameToBeCalled(entry.value, entry.required, entry.field),
                    field: entry.field,
                    required: entry.field.required
                });
            }
        });
        return processedFields;
    }

    private getPropertyNameToBeCalled(caller: string, isCallerRequired: boolean, field: DefinitionPropertyHelper) {
        let name = field.name;

        if (DatabaseFieldHelper.isArrayOfString(field.type) || field.refersTo && field.refersTo.relationship === RelationshipType.ONE_TO_N) {
            if (!field.required) {
                name += '?';
            }
            let methodCaller = null;
            methodCaller = new PropertyDefinition(caller, new TypeDefinition(this.languageDefinition.stringKeyword));
            const propertyName = new PropertyDefinition(name, new TypeDefinition(this.languageDefinition.stringKeyword));
            const callProperty = new PropertyDefinition(this.languageDefinition.callProperty(methodCaller, propertyName, false), new TypeDefinition(this.languageDefinition.stringKeyword));
            return `${this.languageDefinition.methodCall(callProperty, this.languageDefinition.joinMethod, 
                [this.languageDefinition.stringDeclaration(DatabaseTableSchemaClassParser.STRING_TO_ARRAY_SEPARATOR)])}`;
        }

        if (field.type.isEnum) {
            if (!field.required) {
                name += '?';
            }
            name += '.name';
        } else  if (!field.type.isNative && field.refersTo && field.refersTo.definition.needsTable) {
            if (!field.required) {
                name += '?';
            }
            name += '.id';
        }
        
        if (caller) {
            let callerName = caller;
            if (!isCallerRequired) {
                callerName += '?';
            }
            return `${callerName}.${name}`;
        }
        return name;
    }

    createInsertOrUpdateMethod(fields: Array<DefinitionPropertyHelper>) {
        if (this.languageDefinition.hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase) {
            return this.createInsertOrUpdateMethodWithConvenienceMethod(fields);
        }
        const className = this.definition.name;
        const interrogations: Array<string> = [];
        const stringReplacements: Array<string> = [];

        const objectName = this.classNameToVar(className);

        const onlyNativeTypes = fields.filter((property) => {
            return !property.type.isArray() || DatabaseFieldHelper.isArrayOfString(property.type);
        });
        onlyNativeTypes.map(() => {
            interrogations.push('?');
            stringReplacements.push(`\`${this.languageDefinition.stringReplacement}\``);
        });

        const sql = `${this.languageDefinition.stringDeclaration(
            `${this.databaseLanguageDefinition.insertOrUpdateKeyword} \`${this.languageDefinition.stringReplacement}\` (${stringReplacements.join(', ')}) ${this.databaseLanguageDefinition.valuesKeyword} (${interrogations.join(', ')})`)}`;
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        
        const statement = `${this.languageDefinition.methodCall(sqlStringVariable, 'format', this.getFields(onlyNativeTypes, objectName))}`;
        
        const callExecSqlMethod = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'execSQL', [statement]);

        let methodString = `\t\t${this.languageDefinition.returnDeclaration(callExecSqlMethod)}`;

        methodString += `\n${this.getInsertMethodForNonNativeTypes(fields, objectName)}`;

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(this.languageDefinition.intKeyword),
            [
                DatabaseTableSchemaClassParser.databaseObject,
                new ParameterDefinition(`${objectName}`, new TypeDefinition(`${className}`))
            ],
            methodString);
    }

    getInsertMethodForNonNativeTypes(nonNativeTypes: Array<DefinitionPropertyHelper>, objectName: string) {
        const methods = nonNativeTypes.filter((property) => {
            return property.type.isArray() && !DatabaseFieldHelper.isArrayOfString(property.type);
        }).map((property) => {
            const constructObject = new PropertyDefinition(
                this.languageDefinition.constructObject(
                    new TypeDefinition(`${property.type.subType.name}${DatabaseTableSchemaClassParser.classSufix}`), null),
                new TypeDefinition(this.definition.name)
            );

            let notNull = '!!';
            if (property.required) {
                notNull = '';
            }
            const callMethod = this.languageDefinition.methodCall(constructObject, 'batchInsertOrUpdate', ['db', `${objectName}.${property.name}${notNull}`]);
            if (property.required) {
                return `\t\t${callMethod}`;
            } else {
                return `\t\t${this.languageDefinition.ifNotNullStatement(`${objectName}.${property.name}`, callMethod)}`;
            }
        }).join('\n');
        if (methods.length > 1) {
            return `\n${methods}\n\n`;
        } else {
            return '';
        }
    }

    checkIfPropertyIsNativeType(property: DefinitionPropertyHelper): boolean {
        return property.type.isNative || property.type.isEnum || DatabaseFieldHelper.isArrayOfString(property.type);
    }

    getFields(properties: Array<DefinitionPropertyHelper>, objectName: string) {
        let fields = [`${this.getClassNameForStaticConsts()}.${DatabaseTableSchemaClassParser.tableNameProperty}`];
        fields = fields.concat(properties.filter((property) => {
            return DatabaseFieldHelper.getDatabaseNameForProperty(property) !== 'id';
        }).map((property) => {
            return `${this.thisKeyword}.${DatabaseFieldHelper.getFieldNameForProperty(property)}`;
        }));
        
        fields = fields.concat(properties.filter((property) => {
            return DatabaseFieldHelper.getDatabaseNameForProperty(property) !== 'id';
        }).map((property) => {
            const definition = property.refersTo.definition;
            if (definition) {
                return `${objectName}.${definition.name}.${property.name}`;
            } else if (!property.type.isNative && !property.type.subType) {
                return `${objectName}.${property.name}.id`;
            } else {
                return `${objectName}.${property.name}`;
            }
        }));
        return fields;
    }

    createBatchInsertOrUpdateMethod() {
        const className = this.definition.name;
        const variable = this.classNameToVar(className);
        const objectName = `${variable}Array`;

        const callInsertOrUpdateMethod = this.languageDefinition.methodCall(this.thisKeyword, 'insertOrUpdate', ['db', variable]);

        let mapBodyString = callInsertOrUpdateMethod;
        if (this.languageDefinition.lambdaMethodsMustCallReturn) {
            mapBodyString = `${this.languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        }

        const callMapMethod = this.languageDefinition.lambdaMethod(objectName, 'map', variable, mapBodyString);
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
        const tableName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        
        const dbExecCall = this.languageDefinition.methodCall(DatabaseTableSchemaClassParser.databaseObject, 'delete', 
            [tableName, this.languageDefinition.stringDeclaration(`${this.getClassNameForStaticConsts()}.ID_FIELD = ?`), 
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
            [`${this.getClassNameForStaticConsts()}.${DatabaseTableSchemaClassParser.tableNameProperty}`, `${this.getClassNameForStaticConsts()}.ID_FIELD`]);

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

    createReadListFromDbMethod(fields: Array<DefinitionPropertyHelper>) {
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

    createSelectMethod(fields: Array<DefinitionPropertyHelper>) {
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
        const tableName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        
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
        const tableName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldForTableName, false);

        const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableNameForField = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        
        const sqlStringVariable = new PropertyDefinition(sql, new TypeDefinition(this.languageDefinition.stringKeyword));
        const formatMethodCall = this.languageDefinition.methodCall(sqlStringVariable, 'format', [tableName, tableNameForField]);

        const idParam = new ParameterDefinition('id', new TypeDefinition(this.languageDefinition.stringKeyword));

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 'select', [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall, idParam.name]);

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

    createMethodsBasedOnDependencies(fields: Array<DefinitionPropertyHelper>) {
        const methods = this.definition.references.filter((reference) => {
            return reference.definition.needsTable;
        }).map((reference) => {
            if (reference.relationship === RelationshipType.ONE_TO_N) {
                return this.createMethodToSelectOneToN();
            } else if (reference.relationship === RelationshipType.N_TO_ONE) {
                const fieldReference = fields.find((field) => {
                    return field.name === reference.property.name;
                });
                return this.createMethodToSelectNToOne(reference, fieldReference);
            } else {
                return this.createMethodToSelectNToOne(reference, reference.property);
            }
        });

        return ArrayUtils.removeDuplicates(methods.filter((method) => {
            return method !== null;
        }));
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
        const tableName = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldForTableName, false);

        const fieldName = new PropertyDefinition('ID_FIELD', new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableNameForField = this.languageDefinition.callProperty(this.getClassNameForStaticConsts(), fieldName, false);
        
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

    createMethodToSelectNToOne(reference: DefinitionReferenceHelper, fieldReference: DefinitionPropertyHelper) {
        const methodName = `selectBy${reference.definition.name}Id`;

        let sql = `${this.databaseLanguageDefinition.selectAllFieldsKeyword} ${this.databaseLanguageDefinition.fromKeyword} ${this.languageDefinition.stringReplacement}`;
        sql += ` ${this.databaseLanguageDefinition.whereKeyword} ${this.languageDefinition.stringReplacement} = ${this.databaseLanguageDefinition.parameterKeyword}`;
        
        const sqlVariable = new PropertyDefinition(this.languageDefinition.stringDeclaration(sql), new TypeDefinition(this.languageDefinition.stringKeyword));

        const fieldForTableName = new PropertyDefinition(`${reference.definition.name}${DatabaseTableSchemaClassParser.classSufix}`,
            new TypeDefinition(this.languageDefinition.stringKeyword));
        const fieldName = new PropertyDefinition(DatabaseTableSchemaClassParser.tableNameProperty, 
            new TypeDefinition(this.languageDefinition.stringKeyword));
        const tableName = this.languageDefinition.callProperty(fieldForTableName, fieldName, false);

        let field = '';
        if (this.languageDefinition.shouldInsertClassNameForStaticConstsInTheSameClass) {
            field = `${this.className.name}.`;
        }
        if (reference.relationship === RelationshipType.ONE_TO_ONE) {
            field = `${field}${DatabaseFieldHelper.ID}${DatabaseFieldHelper.FIELD_SUFIX}`;
        } else {
            field = `${field}${DatabaseFieldHelper.getFieldNameForProperty(fieldReference)}`;
        }

        const formatMethodCall = this.languageDefinition.methodCall(sqlVariable, 'format', [tableName, field]);

        const dbExecCall = this.languageDefinition.methodCall(this.thisKeyword, 
            'select',
            [DatabaseTableSchemaClassParser.databaseObject.name, formatMethodCall, 'id']);
        
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

    static getFieldNameForProperty(property: DefinitionPropertyHelper) {
        return `${DatabaseFieldHelper.splitName(property).toUpperCase()}${this.FIELD_SUFIX}`;
    }

    private static splitName(property: DefinitionPropertyHelper) {
        let splittedName = StringUtils.splitNameWithUnderlines(property.name);
        if (property.refersTo && property.refersTo.definition) {
            splittedName = `${StringUtils.splitNameWithUnderlines(property.refersTo.definition.name).toLowerCase()}_${splittedName}`;
        }
        if (!property.type.subType && !property.type.isNative) {
            splittedName = `${splittedName}_${this.ID}`;
        }
        return splittedName;
    }

    static getDatabaseNameForProperty(property: DefinitionPropertyHelper) {
        return DatabaseFieldHelper.splitName(property).toLowerCase()
    }

    static isArrayOfString(type: DefinitionTypeHelper) {
        return type.isArray() && type.subType.name === YamlType.TYPE_STRING;
    }

    static toProperty(property: DefinitionPropertyHelper, languageDefinition: LanguageDefinition) {
        return new PropertyDefinition(this.getFieldNameForProperty(property), 
            new TypeDefinition(languageDefinition.stringKeyword, true, null, false, false),
            languageDefinition.stringDeclaration(this.getDatabaseNameForProperty(property)),
            [languageDefinition.staticKeyword, languageDefinition.staticConstKeyword]);
    }

    static getDatabaseFieldProperties(property: DefinitionPropertyHelper, databaseLanguageDefinition: SqliteLanguageDefinition) {
        let properties = [];
        if (property.name === 'id') {
            properties.push(databaseLanguageDefinition.notNullKeyword);
            properties.push(databaseLanguageDefinition.primaryKeyKeyword);
        } else if (property.required) {
            properties.push(databaseLanguageDefinition.notNullKeyword);
        }

        return properties.join(' ');
    }

    static getDatabaseType(type: DefinitionTypeHelper, databaseLanguageDefinition: SqliteLanguageDefinition) {
        if (type.isEnum) {
            return databaseLanguageDefinition.stringKeyword;
        } else if (type.name === 'string') {
            return databaseLanguageDefinition.stringKeyword;
        } else if (type.name === 'number') {
            return databaseLanguageDefinition.numberKeyword;
        } else if (type.name === 'integer') {
            return databaseLanguageDefinition.integerKeyword;
        } else if (type.name === 'boolean') {
            return databaseLanguageDefinition.booleanKeyword;
        } else {
            return null;
        }
    }
}