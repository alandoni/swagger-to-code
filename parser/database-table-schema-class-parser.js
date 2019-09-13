const StringUtils = require('../string-utils');

const PropertyDefinition = require('./definitions/property-definition');

const STRING_TO_ARRAY_SEPARATOR = ';';

module.exports = class DatabaseTableSchemaClassParser {
    constructor() {
        this.classSufix = 'TableSchema';
    }

    parse(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const imports = [ ...classDefinition.dependencies, 'android.database.sqlite.SQLiteDatabase', 'android.database.Cursor'];
        const importsString = languageDefinition.importDeclarations(imports);
        const tableClassName = `${classDefinition.name}${this.classSufix}`;

        const nativeFields = classDefinition.properties.filter((value) => {
            return value.type.indexOf(languageDefinition.mapKeyword) < 0 || 
                value.type.indexOf(languageDefinition.arrayKeyword) < 0 ||
                value.type.indexOf(languageDefinition.arrayKeyword) >= 0 && 
                value.subtype === languageDefinition.stringKeyword;
        });
        
        let tableNameString = `\t${languageDefinition.fieldDeclaration(languageDefinition.publicKeyword, 'TABLE_NAME',  languageDefinition.stringKeyword,
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(classDefinition.name).toLowerCase()))}`;
        
        const fieldsString = this.parseProperties(languageDefinition, nativeFields);

        const methods = [
            this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, nativeFields),
            this.createReadFromDbMethod(languageDefinition, classDefinition, nativeFields),
            this.createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields),
            this.createBatchInsertOrUpdateMethod(languageDefinition, classDefinition),
            this.createDeleteMethod(languageDefinition, databaseLanguageDefinition),
            this.createReadListFromDbMethod(languageDefinition, classDefinition),
            this.createSelectAllMethod(languageDefinition, databaseLanguageDefinition, classDefinition),
            this.createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, classDefinition),
        ].join('\n\n');

        const body = `${tableNameString}\n${fieldsString}\n\n${methods}`;

        const tableClass = `${importsString}\n\n${languageDefinition.classDeclaration(tableClassName, null, body)}`;

        classDefinition.databaseClass = tableClassName;

        console.log(tableClass);
        return tableClass;
    }

    parseProperties(languageDefinition, properties) {
        return properties.map((property) => {
            const field = `${StringUtils.splitNameWithUnderlines(property.name).toUpperCase()}_FIELD`;
            property.field = field;
            return `\t${languageDefinition.fieldDeclaration(languageDefinition.publicKeyword, field, languageDefinition.stringKeyword,
                languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(property.name).toLowerCase()))}`;
        }).join('\n');
    }

    getDatabaseType(languageDefinition, databaseLanguageDefinition, property) {
        if (property.enumDefinition) {
            return databaseLanguageDefinition.stringKeyword;
        }
        if (property.type === languageDefinition.stringKeyword) {
            return databaseLanguageDefinition.stringKeyword;
        }
        if (property.type === languageDefinition.numberKeyword) {
            return databaseLanguageDefinition.numberKeyword;
        }
        if (property.type === languageDefinition.intKeyword || property.type === languageDefinition.booleanKeyword) {
            return databaseLanguageDefinition.integerKeyword;
        }
        return null;
    }

    getDatabaseFieldProperties(databaseLanguageDefinition, field) {
        let properties = [];
        if (field.name === 'id') {
            properties.push(databaseLanguageDefinition.notNullKeyword);
            properties.push(databaseLanguageDefinition.primaryKeyKeyword);
        } else if (field.required) {
            properties.push(databaseLanguageDefinition.notNullKeyword);
        }
        if (properties.length > 0) {
            return properties.join(' ');
        } else {
            return '';
        }
    }

    createCreateTableMethod(languageDefinition, databaseLanguageDefinition, nativeFields) {
        const fields = nativeFields.map((value) => {
            const type = this.getDatabaseType(languageDefinition, databaseLanguageDefinition, value);
            const properties = this.getDatabaseFieldProperties(databaseLanguageDefinition, value);

            let field = `\t\t\t\t\`${languageDefinition.stringReplacement}\` ${type}`;
            if (properties) {
                field += ` ${properties}`;
            }
            return field;
        }).join(',\n');

        const parameters = nativeFields.map((value) => {
            return `\n\t\t\t${languageDefinition.thisKeyword}.${value.field}`;
        });

        const tablePlusParameters = [];
        tablePlusParameters.push(`${languageDefinition.thisKeyword}.TABLE_NAME`);
        tablePlusParameters.push(parameters);

        const tableString = languageDefinition.stringDeclaration(`${databaseLanguageDefinition.createTable} \`${languageDefinition.stringReplacement}\` (
    ${fields}
                    )`);
        const methodCall = `${languageDefinition.methodCall(tableString, 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${languageDefinition.methodCall('db', 'execSQL', [methodCall])};`;
        return `\t${languageDefinition.methodDeclaration('createTable', 
            [
                new PropertyDefinition('db', 'SQLiteDatabase')
            ],
            languageDefinition.voidReturnKeyword, methodString)}`;
    }

    classNameToVar(classDefinition) {
        return classDefinition.name.substr(0, 1).toLowerCase() + classDefinition.name.substr(1);
    }

    createReadFromDbMethod(languageDefinition, classDefinition, nativeFields) {
        const varName = this.classNameToVar(classDefinition);

        const parameters = nativeFields.map((property) => {
            let type = property.type;
            if (property.enumDefinition) {
                type = languageDefinition.stringKeyword;
            }

            switch(type) {
                case languageDefinition.numberKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getDouble', [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                case languageDefinition.stringKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getString',  [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                case languageDefinition.intKeyword:
                case languageDefinition.booleanKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getInt',  [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                case languageDefinition.mapKeyword:
                    return null;
                default:
                    //Array of strings, separated by char
                    if (languageDefinition.stringKeyword === property.subtype) {
                        const callCursorGetStringMethod = languageDefinition.methodCall('cursor', 'getString', [`${languageDefinition.thisKeyword}.${property.field}`]);
                        return `\n\t\t\t${languageDefinition.methodCall(
                            callCursorGetStringMethod, 
                            'split', [STRING_TO_ARRAY_SEPARATOR]
                            )}`;
                    } else {
                        let type = property.type;
                        let getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.${property.field}`]);
                        if (type.indexOf(languageDefinition.arrayKeyword) >= 0 && type.subtype) {
                            type = classDefinition.name;
                            getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.ID_FIELD`]);
                        }
                        const constructObject = languageDefinition.constructObject(`${type}${this.classSufix}`);
                        return `\n\t\t\t${languageDefinition.methodCall(
                            constructObject, 
                            `selectBy${type}Id`, [getId])}`;
                    }
            }
        });

        let methodString = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, classDefinition.name, 
            varName, languageDefinition.constructObject(classDefinition.name, parameters))}`;
        methodString += `\n\t\t${languageDefinition.returnDeclaration(varName)}`;

        return `\t${languageDefinition.methodDeclaration('readFromDb', [new PropertyDefinition('cursor', 'Cursor')],
            classDefinition.name, methodString)}`;
    }

    createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, classDefinition, properties) {
        const interrogations = [];
        const stringReplacements = [];

        const objectName = this.classNameToVar(classDefinition);

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

        return `\t${languageDefinition.methodDeclaration('insertOrUpdate', 
            [
                new PropertyDefinition('db', 'SQLiteDatabase'), 
                new PropertyDefinition(`${objectName}`, `${classDefinition.name}`)
            ],
            languageDefinition.intKeyword, methodString)}`;
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
        methodString = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, languageDefinition.intKeyword, 'result', callExecSqlMethod)}

${methods}

\t\t${languageDefinition.returnDeclaration('result')}`;
        return methodString;
    }

    getFieldsSeparatedByNative(languageDefinition, properties) {
        const onlyNativeTypes = [];
        const nonNativeTypes = [];
        properties.forEach((property) => {
            if (languageDefinition.nativeTypes.indexOf(property.type) > -1 || 
                    (property.type.indexOf(languageDefinition.arrayKeyword) > -1 && property.subtype === languageDefinition.stringKeyword) ||
                    property.enumDefinition) {
                onlyNativeTypes.push(property);
            } else {
                nonNativeTypes.push(property);
            }
        });
        return { onlyNativeTypes, nonNativeTypes };
    }

    getFields(languageDefinition, properties, objectName) {
        const fields = [`\n\t\t\t${languageDefinition.thisKeyword}.TABLE_NAME`];
        fields.push(properties.map((property) => {
            return `\n\t\t\t${languageDefinition.thisKeyword}.${property.field}`;
        }));
        
        fields.push(properties.map((property) => {
            if (property.subtype === languageDefinition.stringKeyword) {
                return `\n\t\t\t${languageDefinition.methodCall(`${objectName}.${property.name}`, 'join', 
                    [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)])}`;
            }
            return `\n\t\t\t${objectName}.${property.name}`;
        }));
        return fields;
    }

    createBatchInsertOrUpdateMethod(languageDefinition, classDefinition) {
        const objectName = this.classNameToVar(classDefinition);

        const callInsertOrUpdateMethod = languageDefinition.methodCall(languageDefinition.thisKeyword, 'insertOrUpdate', ['db', objectName]);
        let mapBodyString = `\t\t\t${languageDefinition.returnDeclaration(callInsertOrUpdateMethod)}`;
        const callMapMethod = languageDefinition.lambdaMethod(`${objectName}s`, 'map', objectName, mapBodyString);
        let methodString = `\t\t${languageDefinition.returnDeclaration(callMapMethod)}`;

        return `\t${languageDefinition.methodDeclaration('batchInsertOrUpdate', 
            [
                new PropertyDefinition('db', 'SQLiteDatabase'), 
                new PropertyDefinition(`${objectName}s`, `${languageDefinition.arrayKeyword}<${classDefinition.name}>`)
            ],
            `${languageDefinition.arrayKeyword}<${languageDefinition.intKeyword}>`, methodString)}`;
    }

    createDeleteMethod(languageDefinition, databaseLanguageDefinition) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.deleteKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall('db', 'execSQL', [formatMethodCall, 'id']);
        const returnCall = `\t\t${languageDefinition.returnDeclaration(dbExecCall)}`;
        return `\t${languageDefinition.methodDeclaration('deleteById', 
        [
            new PropertyDefinition('db', 'SQLiteDatabase'), 
            new PropertyDefinition('id', languageDefinition.intKeyword)
        ], languageDefinition.intKeyword, returnCall)}`;
    }

    createReadListFromDbMethod(languageDefinition, classDefinition) {
        const listDeclaration = this.createListObject(languageDefinition, classDefinition);

        const cursorMoveToNext = languageDefinition.methodCall('cursor', 'moveToNext');
        const readFromDbMethodCall = languageDefinition.methodCall('readFromDb', ['cursor']);
        const whileBody = `\t\t\t${languageDefinition.methodCall('list', 'add', [readFromDbMethodCall])}`;
        const whileStatement = languageDefinition.whileStatement(cursorMoveToNext, whileBody);
        const returnCall = `${languageDefinition.returnDeclaration('list')}`;

        const methodBody = `\t\t${listDeclaration}
\t\t${whileStatement}
\t\t${returnCall}`
        return `\t${languageDefinition.methodDeclaration('readListFromDb', 
        [
            new PropertyDefinition('cursor', 'Cursor'),
        ], languageDefinition.intKeyword, methodBody)}`;
    }

    createListObject(languageDefinition, classDefinition) {
        let listConstruct = languageDefinition.arrayListKeyword;
        if (languageDefinition.shouldConstructList) {
            listConstruct = languageDefinition.constructObject(languageDefinition.arrayListKeyword);
        }
        const listDeclaration = languageDefinition.variableDeclaration(languageDefinition.constKeyword, `${languageDefinition.arrayListKeyword}<${classDefinition.name}>`, 'list', listConstruct);
        return listDeclaration;
    }

    createSelectAllMethod(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
            [`${languageDefinition.thisKeyword}.TABLE_NAME`]);

        const dbExecCall = languageDefinition.methodCall('db', 'rawQuery', [formatMethodCall]);
        
        const methodBody = this.selectMethodBody(languageDefinition, classDefinition, dbExecCall);

        return `\t${languageDefinition.methodDeclaration('selectAll', 
        [
            new PropertyDefinition('db', 'SQLiteDatabase')
        ], `${languageDefinition.arrayKeyword}<${classDefinition.name}>`, methodBody)}`;
    }

    selectMethodBody(languageDefinition, classDefinition, dbExecCall) {
        const cursorDeclaration = languageDefinition.variableDeclaration(languageDefinition.variableKeyword, 'Cursor', 'cursor');
        const listDeclaration = this.createListObject(languageDefinition, classDefinition);
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

    createSelectByIdMethod(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const sql = languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.selectAllFieldsKeyword} ${databaseLanguageDefinition.fromKeyword} ${languageDefinition.stringReplacement} ${databaseLanguageDefinition.whereKeyword} ${languageDefinition.stringReplacement} = ${databaseLanguageDefinition.parameterKeyword}`
        );

        const formatMethodCall = languageDefinition.methodCall(sql, 'format', 
                [`${languageDefinition.thisKeyword}.TABLE_NAME`, `${languageDefinition.thisKeyword}.ID_FIELD`]);

        const dbExecCall = languageDefinition.methodCall('db', 'rawQuery', [formatMethodCall, 'id']);

        const methodBody = this.selectMethodBody(languageDefinition, classDefinition, dbExecCall);

        return `\t${languageDefinition.methodDeclaration('selectById', 
        [
            new PropertyDefinition('db', 'SQLiteDatabase'), 
            new PropertyDefinition('id', languageDefinition.intKeyword)
        ], languageDefinition.intKeyword, methodBody)}`;
    }
}