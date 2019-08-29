const ModelClassParser = require('./model-class-parser');

const StringUtils = require('../string-utils');

const PropertyDefinition = require('./definitions/property-definition');

module.exports = class DatabaseTableSchemaClassParser {
    constructor() {
        this.classSufix = 'TableSchema';
    }

    parse(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const imports = [ ...classDefinition.dependencies, 'android.database.sqlite.SQLiteDatabase', 'android.database.Cursor'];
        const importsString = languageDefinition.importDeclarations(imports);
        const tableClassName = `${classDefinition.name}${this.classSufix}`;

        const nativeFields = classDefinition.properties.filter((value) => {
            return languageDefinition.nativeTypes.indexOf(value.type) > -1 && value.type.indexOf(languageDefinition.arrayKeyword) < 0;
        });
        
        let tableNameString = `\t${languageDefinition.fieldDeclaration(languageDefinition.publicKeyword, 'TABLE_NAME',  languageDefinition.stringKeyword,
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(classDefinition.name).toLowerCase()))}`;
        
        const fieldsString = this.parseProperties(languageDefinition, nativeFields);

        const methods = [this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, nativeFields),
            this.createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields)].join('\n\n');

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

    getDatabaseType(languageDefinition, databaseLanguageDefinition, fieldType) {
        if (fieldType === languageDefinition.stringKeyword) {
            return databaseLanguageDefinition.stringKeyword;
        }
        if (fieldType === languageDefinition.numberKeyword) {
            return databaseLanguageDefinition.numberKeyword;
        }
        if (fieldType === languageDefinition.intKeyword || fieldType === languageDefinition.booleanKeyword) {
            return databaseLanguageDefinition.integerKeyword;
        }
        if (fieldType === languageDefinition.arrayKeyword) {
            return null;
        } else {
            return databaseLanguageDefinition.integerKeyword;
        }
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
            const type = this.getDatabaseType(languageDefinition, databaseLanguageDefinition, value.type);
            const properties = this.getDatabaseFieldProperties(databaseLanguageDefinition, value);

            let field = `\t\t\t\t${languageDefinition.stringReplacement} ${type}`;
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

    createReadFromDbMethod(languageDefinition, databaseLanguageDefinition, classDefinition, nativeFields) {
        const varName = classDefinition.name.substr(0, 1).toLowerCase() + classDefinition.name.substr(1);

        const parameters = nativeFields.map((property) => {
            switch(property.type) {
                case languageDefinition.numberKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getDouble', [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                case languageDefinition.stringKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getString',  [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                case languageDefinition.intKeyword:
                case languageDefinition.booleanKeyword:
                    return `\n\t\t\t${languageDefinition.methodCall('cursor', 'getInt',  [`${languageDefinition.thisKeyword}.${property.field}`])}`;
                default:
                    const getId = languageDefinition.methodCall('cursor', 'getInt', [`${languageDefinition.thisKeyword}.ID_FIELD`]);
                    return `\n\t\t\t${languageDefinition.methodCall(
                        languageDefinition.constructObject(`${property.type}${this.classSufix}`), 
                        `selectBy${classDefinition.name}Id`, [getId])}`;
            }
        });

        let methodString = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, classDefinition.name, 
            varName, languageDefinition.constructObject(classDefinition.name, parameters))}`;
        methodString += `\n\t\t${languageDefinition.returnDeclaration(varName)}`;

        return `\t${languageDefinition.methodDeclaration('readFromDb', [new PropertyDefinition('cursor', 'Cursor')],
            classDefinition.name, methodString)}`;
    }
}