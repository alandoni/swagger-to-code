const ModelClassParser = require('./model-class-parser');

module.exports = class DatabaseTableSchemaClassParser {
    constructor() {
        this.regex = new RegExp('(?=[A-Z])','g');
    }

    parse(languageDefinition, classDefinition) {
        const tableClassString = `${languageDefinition.classKeyword} ${classDefinition.name}TableSchema`;

        let tableNameString = `\t${ModelClassParser.getProperty(languageDefinition, 'TABLE_NAME', languageDefinition.stringKeyword, 
            this.splitNameWithUnderlines(classDefinition.name).toLowerCase(), true)}`;
        
        const fieldsString = this.parseProperties(languageDefinition, classDefinition.properties);
        const methods = "";

        const tableClass = `${tableClassString} {\n${tableNameString}\n${fieldsString}\n${methods}\n}\n`;
        console.log(tableClass);
        return tableClass;
    }

    parseProperties(languageDefinition, properties) {
        let propertiesString = '';
        properties.map((property) => {
            const field = `${this.splitNameWithUnderlines(property.name).toUpperCase()}_FIELD`;

            let propertyString = `\t${ModelClassParser.getProperty(languageDefinition, field, languageDefinition.stringKeyword, 
                this.splitNameWithUnderlines(property.name).toLowerCase(), true)}`;

            propertiesString += `${propertyString}`;
        });
        return propertiesString;
    }

    splitNameWithUnderlines(name) {
        const names = name.split(this.regex)
        return names.join('_');
    }
}