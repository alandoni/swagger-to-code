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
            return value.type.indexOf(languageDefinition.mapKeyword) < 0;
        });
        
        let tableNameString = `\t${languageDefinition.fieldDeclaration(languageDefinition.publicKeyword, 'TABLE_NAME',  languageDefinition.stringKeyword,
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(classDefinition.name).toLowerCase()))}`;
        
        const fieldsString = this.parseProperties(languageDefinition, nativeFields);

        const methods = [
            this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, nativeFields),
            this.createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields),
            this.createInsertOrUpdateMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields),
            this.createBatchInsertOrUpdateMethod(languageDefinition, classDefinition),
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
        return `\t${languageDefinition.methodDeclaration('createTable', [new PropertyDefinition('db', 'SQLiteDatabase')],
            languageDefinition.voidReturnKeyword, methodString)}`;
    }

    classNameToVar(classDefinition) {
        return classDefinition.name.substr(0, 1).toLowerCase() + classDefinition.name.substr(1);
    }

    createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields) {
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
                    if (property.subtype) {
                        type = property.subtype;
                    }

                    if (type === languageDefinition.stringKeyword) {
                        return `\n\t\t\t${languageDefinition.methodCall(
                            languageDefinition.methodCall('cursor', 'getString', [`${languageDefinition.thisKeyword}.${property.field}`]), 
                            'split', [STRING_TO_ARRAY_SEPARATOR]
                            )}`;
                    } else {
                        const getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.ID_FIELD`]);
                        return `\n\t\t\t${languageDefinition.methodCall(
                            languageDefinition.constructObject(`${type}${this.classSufix}`), 
                            `selectBy${classDefinition.name}Id`, [getId])}`;
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
        
        const onlyNativeTypes = [];
        const nonNativeTypes = [];

        const fields = [`\n\t\t\t${languageDefinition.thisKeyword}.TABLE_NAME`];
        const objectName = this.classNameToVar(classDefinition);

        properties.forEach((property) => {
            if (languageDefinition.nativeTypes.indexOf(property.type) > -1 || 
                    (property.type.indexOf(languageDefinition.arrayKeyword) > -1 && property.subtype === languageDefinition.stringKeyword) ||
                    property.enumDefinition) {
                onlyNativeTypes.push(property);
            } else {
                nonNativeTypes.push(property);
            }
        });

        fields.push(onlyNativeTypes.map((property) => {
            interrogations.push('?');
            stringReplacements.push(`\`${languageDefinition.stringReplacement}\``);
            return `\n\t\t\t${languageDefinition.thisKeyword}.${property.field}`;
        }));
        
        fields.push(onlyNativeTypes.map((property) => {
            if (property.subtype === languageDefinition.stringKeyword) {
                return `\n\t\t\t${languageDefinition.methodCall(`${objectName}.${property.name}`, 'join', 
                    [languageDefinition.stringDeclaration(STRING_TO_ARRAY_SEPARATOR)])}`;
            }
            return `\n\t\t\t${objectName}.${property.name}`;
        }));

        const insertString = `${languageDefinition.stringDeclaration(
            `${databaseLanguageDefinition.insertOrUpdateKeyword} \`${languageDefinition.stringReplacement}\` (${stringReplacements.join(', ')}) ${databaseLanguageDefinition.valuesKeyword} (${interrogations.join(', ')})`)}`;
        const statement = `${languageDefinition.methodCall(insertString, 'format', fields)}`;
        
        let methodString = `\t\t${languageDefinition.returnDeclaration(languageDefinition.methodCall('db', 'execSQL', [statement]))}`;
        if (nonNativeTypes.length > 0) {
            const methods = nonNativeTypes.map((property) => {
                let methodName = 'insertOrUpdate';
                if (property.type.indexOf(languageDefinition.arrayKeyword) > -1) {
                    methodName = 'batchInsertOrUpdate';
                }
                return `\t\t${languageDefinition.methodCall(
                    languageDefinition.constructObject(`${property.subtype}${this.classSufix}`), 
                    methodName, ['db', `${objectName}.${property.name}`])};`;
            }).join('\n');

            methodString = `\t\t${languageDefinition.variableDeclaration(
                'val', languageDefinition.intKeyword, 'result', languageDefinition.methodCall('db', 'execSQL', [statement]))}

${methods}

\t\t${languageDefinition.returnDeclaration('result')}`;
        }

        return `\t${languageDefinition.methodDeclaration('insertOrUpdate', 
            [
                new PropertyDefinition('db', 'SQLiteDatabase'), 
                new PropertyDefinition(`${objectName}`, `${classDefinition.name}`)
            ],
            languageDefinition.intKeyword, methodString)}`;
    }

    createBatchInsertOrUpdateMethod(languageDefinition, classDefinition) {
        const objectName = this.classNameToVar(classDefinition);

        let mapBodyString = `\t\t\t${languageDefinition.returnDeclaration(languageDefinition.methodCall(languageDefinition.thisKeyword, 'insertOrUpdate', ['db', objectName]))}`;
        let methodString = `\t\t${languageDefinition.returnDeclaration(languageDefinition.lambdaMethod(`${objectName}s`, 'map', objectName, mapBodyString))}`;

        return `\t${languageDefinition.methodDeclaration('batchInsertOrUpdate', 
            [
                new PropertyDefinition('db', 'SQLiteDatabase'), 
                new PropertyDefinition(`${objectName}s`, `${languageDefinition.arrayKeyword}<${classDefinition.name}>`)
            ],
            `${languageDefinition.arrayKeyword}<${languageDefinition.intKeyword}>`, methodString)}`;
    }
}