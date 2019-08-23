const ModelClassParser = require('./model-class-parser');

const StringUtils = require('../string-utils');

module.exports = class DatabaseTableSchemaClassParser {
    parse(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const tableClassName = `${classDefinition.name}TableSchema`;
        
        let tableNameString = `\t${languageDefinition.fieldDeclaration(languageDefinition.publicKeyword, 'TABLE_NAME',  languageDefinition.stringKeyword,
            languageDefinition.stringDeclaration(StringUtils.splitNameWithUnderlines(classDefinition.name).toLowerCase()))}`;
        
        const fieldsString = this.parseProperties(languageDefinition, classDefinition.properties);

        const methods = this.createCreateTableMethod(languageDefinition, databaseLanguageDefinition, classDefinition);

        const body = `${tableNameString}\n${fieldsString}\n\n${methods}`;

        const tableClass = `${languageDefinition.classDeclaration(tableClassName, null, body)}`;

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

    createCreateTableMethod(languageDefinition, databaseLanguageDefinition, classDefinition) {
        const fields = classDefinition.properties.map((value) => {
            const type = this.getDatabaseType(languageDefinition, databaseLanguageDefinition, value.type);
            const properties = this.getDatabaseFieldProperties(databaseLanguageDefinition, value);

            let field = `\t\t\t\t${languageDefinition.stringReplacement} ${type}`;
            if (properties) {
                field += ` ${properties}`;
            }
            return field;
        }).join(',\n');

        const parameters = classDefinition.properties.map((value) => {
            return `\n\t\t\t${languageDefinition.thisKeyword}.${value.field}`;
        });

        const tablePlusParameters = [];
        tablePlusParameters.push(`${languageDefinition.thisKeyword}.TABLE_NAME`);
        tablePlusParameters.push(parameters);

        const tableString = languageDefinition.stringDeclaration(`${databaseLanguageDefinition.createTable} \`${languageDefinition.stringReplacement}\` (
    ${fields}
                    )`);
        const methodCall = `${languageDefinition.methodCall(tableString, 'format', tablePlusParameters)}`;
        
        let methodString = `\t\t${languageDefinition.returnDeclaration(methodCall)}`;
        return `\t${languageDefinition.methodDeclaration('createTable', null, languageDefinition.voidReturnKeyword, methodString)}`;
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
}