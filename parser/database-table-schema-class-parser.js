const StringUtils = require('../string-utils');

const PropertyDefinition = require('./definitions/property-definition');
const ConstrutorDefinition = require('./definitions/constructor-definition');
const MethodDefinition = require('./definitions/method-definition');
const EnumDefinition = require('./definitions/enum-definition');
const ClassDefinition = require('./definitions/class-definition');
const TypeDefinition = require('./definitions/type-definition');

const ModelClassParser = require('./model-class-parser');

const STRING_TO_ARRAY_SEPARATOR = ';';

module.exports = class DatabaseTableSchemaClassParser {
    constructor() {
        this.classSufix = 'TableSchema';
        this.tableNameProperty = 'TABLE_NAME';
        this.databaseObject = new PropertyDefinition('db', new TypeDefinition('SQLiteDatabase'));
    }

    parse(languageDefinition, databaseLanguageDefinition, definition) {
        const nativeDependencies = [
            new TypeDefinition('android.database.sqlite.SQLiteDatabase'),
            new TypeDefinition('android.database.Cursor'),
        ];
        const className = definition.name;
        const tableClassName = `${className}${this.classSufix}`;

        const definitionsProperties = ModelClassParser.parseProperties(
            languageDefinition,
            definition.properties,
            definition.requiredProperties);

        const fields = this.propertiesToFields(databaseLanguageDefinition, languageDefinition, definitionsProperties);
        
        const parseDependencies = ModelClassParser.parseDependencies(definitionsProperties);

        const dependencies = [
            ...nativeDependencies, 
            ...parseDependencies,
            ...parseDependencies.map((dependency) => {
                return new TypeDefinition(`${dependency.name}${this.classSufix}`);
            })
        ];
        
        let tableNameString = new PropertyDefinition(
            this.tableNameProperty,
            new TypeDefinition(languageDefinition.stringKeyword),
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(className).toLowerCase()),
            null,
            false);

        const methods = [
            this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, fields),
            this.createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, className, fields),
            this.createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, className, fields),
            this.createBatchInsertOrUpdateMethod(languageDefinition, className),
            this.createDeleteMethod(languageDefinition, databaseLanguageDefinition),
            this.createReadListFromDbMethod(languageDefinition, className),
            this.createSelectAllMethod(languageDefinition, databaseLanguageDefinition, className),
            this.createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, className),
        ];

        const properties = [tableNameString, ...fields.map((field) => {
            return field.toProperty(languageDefinition);
        })];

        const tableClass = new ClassDefinition(tableClassName, properties, null, methods, null, dependencies);

        return tableClass;
    }

    propertiesToFields(databaseLanguageDefinition, languageDefinition, properties) {
        return properties.map((property) => {
            return new DatabaseFieldHelper(databaseLanguageDefinition, languageDefinition, property.name, property.type, property.required);
        });
    }

    createCreateTableMethod(languageDefinition, databaseLanguageDefinition, fields) {
        const typedFields = fields.filter((field) => {
            return !field.searchById;
        });

        const databaseFields = typedFields.map((field) => {
            const properties = field.getDatabaseFieldProperties(databaseLanguageDefinition);

            let fieldString = `\t\t\t\t\`${languageDefinition.stringReplacement}\` ${field.databaseType.print()}`;
            if (properties) {
                fieldString += ` ${properties}`;
            }
            return fieldString;
        }).join(',\n');

        const parameters = typedFields.map((field) => {
            return `\t\t${languageDefinition.thisKeyword}.${field.fieldName}`;
        });

        const tablePlusParameters = [`${languageDefinition.thisKeyword}.TABLE_NAME`, ...parameters];
        
        const tableString = languageDefinition.stringDeclaration(`${databaseLanguageDefinition.createTable} \`${languageDefinition.stringReplacement}\` (
    ${databaseFields}
\t\t\t)`);
        const methodCall = `${languageDefinition.methodCall(tableString, 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${languageDefinition.methodCall('db', 'execSQL', [methodCall])};`;

        return new MethodDefinition('createTable', 
            new TypeDefinition(languageDefinition.voidReturnKeyword),
            [
                this.databaseObject
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    classNameToVar(className) {
        return className.substr(0, 1).toLowerCase() + className.substr(1);
    }

    createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, className, fields) {
        const varName = this.classNameToVar(className);

        const parameters = fields.map((field) => {
            const nonNative = this.handleNonNativeTypes(languageDefinition, className, field);
            if (nonNative) {
                return nonNative;
            }
            switch(field.databaseType.name) {
                case databaseLanguageDefinition.numberKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getDouble', [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case databaseLanguageDefinition.stringKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getString',  [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                case databaseLanguageDefinition.integerKeyword:
                    return `${languageDefinition.methodCall('cursor', 'getInt',  [`${languageDefinition.thisKeyword}.${field.fieldName}`])}`;
                default:
                    //throw new Error(`QUE? ${JSON.stringify(field)}`);
            }
        });

        let methodString = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, className, 
            varName, languageDefinition.constructObject(className, parameters))}`;
        methodString += `\n\t\t${languageDefinition.returnDeclaration(varName)}`;

        return new MethodDefinition('readFromDb', 
            new TypeDefinition(className),
            [   
                new PropertyDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    handleNonNativeTypes(languageDefinition, className, field) {
        if (field.searchByDependencyId) {
            const constructObject = languageDefinition.constructObject(`${field.type.name}${this.classSufix}`);
            let getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                constructObject, 
                `selectById`, [getId])}`;
        }
        if (field.searchById) {
            const constructObject = languageDefinition.constructObject(`${className}${this.classSufix}`);
            let getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                constructObject, 
                `selectBy${className}Id`, [getId])}`;
        }
        if (field.isArrayOfString) {
            const callCursorGetStringMethod = languageDefinition.methodCall('cursor', 'getString', 
                [`${languageDefinition.thisKeyword}.${field.fieldName}`]);
            return `${languageDefinition.methodCall(
                callCursorGetStringMethod, 
                'split', [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)]
            )}`;
        }
        return null;
    }

    createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, className, properties) {
        const interrogations = [];
        const stringReplacements = [];

        const objectName = this.classNameToVar(className);

        const { onlyNativeTypes, nonNativeTypes } = this.getFieldsSeparatedByNative(languageDefinition, properties)

        onlyNativeTypes.map(() => {
            interrogations.push('?');
            stringReplacements.push(`\`${languageDefinition.stringReplacement}\``);
        });

        const sql = `${languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.insertOrUpdateKeyword} \`${languageDefinition.stringReplacement}\` (${stringReplacements.join(', ')}) ${databaseLanguageDefinition.valuesKeyword} (${interrogations.join(', ')})`)}`;
        
        const statement = `${languageDefinition.methodCall(sql, 'format', this.getFields(languageDefinition, onlyNativeTypes, objectName))}`;
        
        const callExecSqlMethod = languageDefinition.methodCall('db', 'execSQL', [statement]);
        let methodString = `\t\t${languageDefinition.returnDeclaration(callExecSqlMethod)}`;
        if (nonNativeTypes.length > 0) {
            methodString = this.getInsertMethodForNonNativeTypes(languageDefinition, nonNativeTypes, objectName, methodString, statement);
        }

        return new MethodDefinition('insertOrUpdate',
            new TypeDefinition(languageDefinition.intKeyword),
            [
                this.databaseObject,
                new PropertyDefinition(`${objectName}`, new TypeDefinition(`${className}`))
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    getInsertMethodForNonNativeTypes(languageDefinition, nonNativeTypes, objectName, methodString, statement) {
        const methods = nonNativeTypes.filter((property) => {
            return property.subtype != null;
        }).map((property) => {
            let methodName = 'insertOrUpdate';
            if (property.type.indexOf(languageDefinition.arrayKeyword) > -1) {
                methodName = 'batchInsertOrUpdate';
            }
            const constructObject = languageDefinition.constructObject(`${property.subtype}${this.classSufix}`);
            return `\t\t${languageDefinition.methodCall(constructObject, methodName, ['db', `${objectName}.${property.name}`])};`;
        }).join('\n');

        const callExecSqlMethod = languageDefinition.methodCall('db', 'execSQL', [statement]);
        methodString = `\t\t${languageDefinition.variableDeclaration(
            languageDefinition.constKeyword, 
            new TypeDefinition(languageDefinition.intKeyword), 
            'result',
            callExecSqlMethod)}

${methods}

\t\t${languageDefinition.returnDeclaration('result')}`;
        return methodString;
    }

    getFieldsSeparatedByNative(languageDefinition, properties) {
        const onlyNativeTypes = [];
        const nonNativeTypes = [];
        properties.forEach((property) => {
            if (property.type.isNative > -1 || this.isArrayOfString(languageDefinition, property.type) || property.enumDefinition) {
                onlyNativeTypes.push(property);
            } else {
                nonNativeTypes.push(property);
            }
        });
        return { onlyNativeTypes, nonNativeTypes };
    }

    getFields(languageDefinition, properties, objectName) {
        let fields = [`${languageDefinition.thisKeyword}.TABLE_NAME`];
        fields = fields.concat(properties.map((property) => {
            return `${languageDefinition.thisKeyword}.${property.fieldName}`;
        }));
        
        fields = fields.concat(properties.map((property) => {
            if (property.subtype === languageDefinition.stringKeyword) {
                return `${languageDefinition.methodCall(`${objectName}.${property.propertyName}`, 'join', 
                    [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)])}`;
            }
            return `${objectName}.${property.propertyName}`;
        }));
        return fields;
    }

    createBatchInsertOrUpdateMethod(languageDefinition, className) {
        const objectName = this.classNameToVar(className);

        const callInsertOrUpdateMethod = languageDefinition.methodCall(languageDefinition.thisKeyword, 'insertOrUpdate', ['db', objectName]);
        let mapBodyString = `\t\t\t${languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        const callMapMethod = languageDefinition.lambdaMethod(objectName, 'map', objectName, mapBodyString);
        let methodString = `\t\t${languageDefinition.returnDeclaration(callMapMethod)}`;

        return new MethodDefinition('batchInsertOrUpdate',
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(languageDefinition.intKeyword)),
            [
                this.databaseObject, 
                new PropertyDefinition(objectName, new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className))),
            ],
            methodString,
            languageDefinition.publicKeyword);
    }

    createDeleteMethod(languageDefinition, databaseLanguageDefinition) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.deleteKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall('db', 'execSQL', [formatMethodCall, 'id']);
        const returnCall = `\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;
        return new MethodDefinition('deleteById',
            new TypeDefinition(languageDefinition.intKeyword),
            [
                this.databaseObject, 
                new PropertyDefinition('id', new TypeDefinition(languageDefinition.intKeyword)),
            ],
            returnCall,
            languageDefinition.publicKeyword);
    }

    createReadListFromDbMethod(languageDefinition, className) {
        const listDeclaration = this.createListObject(languageDefinition, className);

        const cursorMoveToNext = languageDefinition.methodCall('cursor', 'moveToNext');
        const readFromDbMethodCall = languageDefinition.methodCall('readFromDb', ['cursor']);
        const whileBody = `\t\t\t${languageDefinition.methodCall('list', 'add', [readFromDbMethodCall])}`;
        const whileStatement = languageDefinition.whileStatement(cursorMoveToNext, whileBody);
        const returnCall = `${languageDefinition.returnDeclaration('list')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${whileStatement}
\t\t${returnCall}`
        return new MethodDefinition('readListFromDb', 
            new TypeDefinition(languageDefinition.intKeyword),
            [
                new PropertyDefinition('cursor', new TypeDefinition('Cursor')),
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }

    createListObject(languageDefinition, className) {
        let listConstruct = languageDefinition.arrayListKeyword;
        if (languageDefinition.shouldConstructList) {
            listConstruct = languageDefinition.constructObject(languageDefinition.arrayListKeyword);
        }
        const listDeclaration = languageDefinition.variableDeclaration(languageDefinition.constKeyword, `${languageDefinition.arrayListKeyword}<${className}>`, 'list', listConstruct);
        return listDeclaration;
    }

    selectMethodBody(languageDefinition, className, dbExecCall) {
        const cursorDeclaration = languageDefinition.variableDeclaration(languageDefinition.variableKeyword, 'Cursor', 'cursor');
        const listDeclaration = this.createListObject(languageDefinition, className);
        const assignRawQueryToCursor = languageDefinition.assignment('cursor', dbExecCall);
        const callReadListFromDbMethod = languageDefinition.methodCall(languageDefinition.thisKeyword, 'readListFromDb', ['cursor']);
        const assignList = languageDefinition.assignment('list', callReadListFromDbMethod);
        const tryBody = `\t\t\t${assignRawQueryToCursor}
\t\t\t${assignList}`;
        const catchBody = `\t\t\t${languageDefinition.methodCall(languageDefinition.thisKeyword, 'onError')}`;
        const finallyBody = `\t\t\t${languageDefinition.methodCall('cursor', 'close')}
\t\t\t${languageDefinition.methodCall('db', 'close')}`;
        const tryCatch = languageDefinition.tryCatchStatement(tryBody, catchBody, finallyBody);
        const returnCall = `\t\t${languageDefinition.returnDeclaration('list')}`;
        const methodBody = `\t\t${listDeclaration}
\t\t${cursorDeclaration}

${tryCatch}

${returnCall}`;
        return methodBody;
    }

    createSelectAllMethod(languageDefinition, databaseLanguageDefinition, className) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = languageDefinition.methodCall('db', 'rawQuery', [formatMethodCall]);
        
        const methodBody = this.selectMethodBody(languageDefinition, className, dbExecCall);

        return new MethodDefinition('selectAll', 
            new TypeDefinition(languageDefinition.arrayKeyword, true, new TypeDefinition(className)),
            [
                this.databaseObject,
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }

    createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, className) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
                [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall('db', 'rawQuery', [formatMethodCall, 'id']);

        const methodBody = this.selectMethodBody(languageDefinition, className, dbExecCall);

        return new MethodDefinition('selectById',
            new TypeDefinition(languageDefinition.intKeyword),
            [
                this.databaseObject,
                new PropertyDefinition('id', new TypeDefinition(languageDefinition.intKeyword)),
            ],
            methodBody,
            languageDefinition.publicKeyword);
    }
}

class DatabaseFieldHelper {
    constructor(databaseLanguageDefinition, languageDefinition, propertyName, type, required) {
        this.fieldSufix = '_FIELD';

        this.type = type;

        this.propertyName = propertyName;
        let splittedName = StringUtils.splitNameWithUnderlines(this.propertyName);
        this.fieldName = `${splittedName.toUpperCase()}${this.fieldSufix}`;
        this.searchById = false;
        this.searchByDependencyId = false;
        this.isArrayOfString = false;

        if (this.type.subtype && !this.type.subtype.isNative) { // Is an array of other model
            this.searchById = true;
            this.searchByDependencyId = false;
            this.fieldName = 'ID_FIELD';
            this.databaseFieldName = null;
        } else if (!this.type.subtype && !this.type.isNative) { // Is not an array
            this.searchById = false;
            this.searchByDependencyId = true;
            splittedName = `${splittedName}_ID`;
            this.fieldName = `${splittedName.toUpperCase()}${this.fieldSufix}`;
            this.databaseType = new DatabaseTypeDefinition(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else if (this.type.subtype && DatabaseFieldHelper.isArrayOfString(languageDefinition, this.type)) {
            this.isArrayOfString = true;
            this.databaseType = new DatabaseTypeDefinition(new TypeDefinition(languageDefinition.stringKeyword), languageDefinition, databaseLanguageDefinition);
        } else {
            this.databaseType = new DatabaseTypeDefinition(this.type, languageDefinition, databaseLanguageDefinition);
        }

        this.databaseFieldName = languageDefinition.stringDeclaration(splittedName.toLowerCase());        
        this.required = required;
    }

    static isArrayOfString(languageDefinition, type) {
        return type.name.indexOf(languageDefinition.arrayKeyword) > - 1 && type.subtype.name === languageDefinition.stringKeyword;
    }

    toProperty(languageDefinition) {
        return new PropertyDefinition(this.fieldName, 
            new TypeDefinition(languageDefinition.stringKeyword, true),
            this.databaseFieldName,
            this.required,
            true);
    }

    getDatabaseFieldProperties(databaseLanguageDefinition) {
        let properties = [];
        if (this.propertyName === 'id') {
            properties.push(databaseLanguageDefinition.notNullKeyword);
            properties.push(databaseLanguageDefinition.primaryKeyKeyword);
        } else if (this.required) {
            properties.push(databaseLanguageDefinition.notNullKeyword);
        }

        return properties.join(' ');
    }
}

class DatabaseTypeDefinition {
    constructor(type, languageDefinition, databaseLanguageDefinition) {
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

    print() {
        return this.name;
    }
}