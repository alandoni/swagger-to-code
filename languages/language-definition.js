const StringUtils = require('../string-utils');

class LanguageDefinition {
    importDeclarations(imports) {
        return imports.map((importFile) => {
            return `const ${importFile.name} = require(${importFile.file});`;
        }).join('\n');
    }

    classDeclaration(className, inheritsFrom, body, isDataClass) {
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` extends ${inheritsFrom}`;
        }
        return `class ${className}${inherits} {\n${body}\n}`;
    }

    parameterDeclaration(parameterName, type) {
        return parameterName;
    }

    methodDeclaration(methodName, parameters, returnType, body) {
        return `${methodName}(${this.printParametersNames(parameters)}) {
    ${body}
    }`;
    }

    printParametersNames(parameters) {
        if (!parameters || parameters.length == 0) {
            return '';
        }
        return parameters.map((parameter) => {
            return parameter.name;
        }).join(', ');
    }

    fieldDeclaration(visibility, name, type, defaultValue) {
        let field = `get ${name}() {\n`;
        if (defaultValue) {
            field += `\treturn ${defaultValue};`;
        }
        field += '\n}';
        return field;
    }

    methodCall(caller, methodName, parameterValues) {
        return `${caller}.${methodName}(${this.printParametersNames(parameterValues)})`;
    }

    variableDeclaration(declareType, type, name, defaultValue) {
        let variable = `${declareType} ${name}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable +=';';
    }

    returnDeclaration(value) {
        return `return ${value};`;
    }

    constructorDeclaration(className, parameters, returnType, body, isDataClass) {
        return `contructor(${this.printParametersNames(parameters)}) {
    ${this.parameters.map((value) => {
        return `this.${value.name} = ${value.name};`;
    }).join('\n')}
    ${body}
    }`;
    }

    enumDeclaration(enumName, values) {
        return `class ${enumName} {
    ${values.map((value, index) => {
        return `${StringUtils.splitNameWithUnderlines(value).toUpperCase()} = ${index}`;
    })}
    }`;
    }

    ifStatement(condition, body) {
        return `if (${condition}) {
    ${body}
    }`;
    }

    ifNullStatement(object, body) {
        return `if (${object}) {
    ${body}
}`;
    }

    assignment(name1, name2) {
        return `${name1} = ${name2};`;
    }

    constructObject(type, parameters) {
        return `new ${this.methodCall(type, parameters)})`;
    }

    stringDeclaration(content) {
        return `'${content}'`;
    }

    get nativeTypes() {
        return [this.stringKeyword,
            this.numberKeyword,
            this.intKeyword,
            this.booleanKeyword,
            this.arrayKeyword,
            this.mapKeyword];
    }
    get useDataclassForModels() {
        return false;
    }
    get isTypesafeLanguage() {
        return false;
    }
    get thisKeyword() {
        return "this";
    }
    get constKeyword() {
        return "val";
    }
    get variableKeyword() {
        return "var";
    }
    get nullKeyword() {
        return "null";
    }
    get anyTypeKeyword() {
        return "";
    }
    get intKeyword() {
        return "";
    }
    get numberKeyword() {
        return "";
    }
    get stringKeyword() {
        return "";
    }
    get booleanKeyword() {
        return "";
    }
    get falseKeyword() {
        return "false";
    }
    get trueKeyword() {
        return "true";
    }
    get arrayKeyword() {
        return "";
    }
    get mapKeyword() {
        return "";
    }
    get publicKeyword() {
        return "";
    }
    get privateKeyword() {
        return "";
    }
    get stringReplacement() {
        return "%s";
    }

    compareTypeOfObjectsMethod(var1, var2) {
        return "";
    }

    equalMethod(var1, var2, negative) {
        let equal = "===";
        if (negative) {
            equal = "!==";
        }
        return `${var1} ${equal} ${var2}`;
    }

    simpleComparison(var1, var2, negative) {
        let equal = "==";
        if (negative) {
            equal = "!=";
        }
        return `${var1} ${equal} ${var2}`;
    }
}

module.exports = LanguageDefinition;
