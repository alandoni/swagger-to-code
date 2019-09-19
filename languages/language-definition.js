const StringUtils = require('../string-utils');

class LanguageDefinition {
    importDeclarations(imports) {
        return imports.map((importFile) => {
            return `const ${importFile} = require(${this.stringDeclaration(`./${importFile}`)});`;
        }).join('\n');
    }

    classDeclaration(className, inheritsFrom, body, isDataClass) {
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` extends ${inheritsFrom}`;
        }
        return `class ${className}${inherits} {\n\n${body}\n}`;
    }

    parameterDeclaration(parameterName, type) {
        return parameterName;
    }

    methodDeclaration(methodName, parameters, returnType, body) {
        return `${methodName}(${this.printParametersNamesWithTypes(parameters)}) {
${body}
\t}`;
    }

    printParametersNamesWithTypes(parameters, declareKeyword, shouldBreakLine = false) {
        if (!parameters || parameters.length == 0) {
            return '';
        }
        return parameters.map((parameter) => {
            return parameter.name;
        }).join(', ');
    }

    printValues(values, shouldBreakLine) {
        if (!values || values.length === 0) {
            return '';
        }
        let separator = ', ';
        if (shouldBreakLine) {
            separator = ',\n\t\t\t';
        }
        return values.map((value) => {
            return `${value}`;
        }).join(separator);
    }

    fieldDeclaration(visibility, name, type, defaultValue) {
        let field = `get ${name}() {\n`;
        if (defaultValue) {
            field += `\t\t${this.returnDeclaration(defaultValue)}`;
        }
        field += '\n\t}';
        return field;
    }

    methodCall(caller, methodName, parameterValues) {
        let callerString = '';
        if (caller) {
            callerString = `${caller}.`;
        }
        let shouldBreakLine = true;
        if (parameterValues.length < 4) {
            shouldBreakLine = false;
        }
        return `${callerString}${methodName}(${this.printValues(parameterValues, shouldBreakLine)})`;
    }

    variableDeclaration(declareType, type, name, defaultValue) {
        let variable = `${declareType} ${name}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable += ';';
    }

    returnDeclaration(value) {
        return `return ${value};`;
    }

    constructorDeclaration(className, parameters, returnType, body, isDataClass) {
        return `contructor(${this.printParametersNamesWithTypes(parameters)}) {
${parameters.map((value) => {
        return `\t\tthis.${value.name} = ${value.name};`;
    }).join('\n')}
\t}`;
    }

    get constructorAlsoDeclareFields() {
        return false;
    }

    enumDeclaration(enumName, values) {
        return `\tclass ${enumName} {
    ${values.map((value, index) => {
        return `\t\t${value} = ${index}`;
    }).join(',\n')}
\t}`;
    }

    ifStatement(condition, body) {
        return `if (${condition}) {
    ${body}
\t\t}`;
    }

    whileStatement(condition, body) {
        return `while (${condition}) {
    ${body}
\t\t}`;
    }

    lambdaMethod(caller, method, varName, body) {
        return `${caller}.${method} { (${varName}) ->
    ${body}
\t\t}`;
    }

    ifNullStatement(object, body) {
        return this.ifStatement(`!${object}`, body);
    }

    assignment(name1, name2) {
        return `${name1} = ${name2};`;
    }

    constructObject(type, parameters) {
        return `new ${this.methodCall(null, type, parameters)}`;
    }

    stringDeclaration(content) {
        return `'${content}'`;
    }

    tryCatchStatement(tryBody, catchBody, finallyBody) {
        return `\t\ttry {
    ${tryBody}
\t\t} catch (error) {
    ${catchBody}
\t\t} finally {
    ${finallyBody}
\t\t}`
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
    get needDeclareFields() {
        return false;
    }
    get isTypesafeLanguage() {
        return false;
    }
    get thisKeyword() {
        return 'this';
    }
    get constKeyword() {
        return 'const';
    }
    get variableKeyword() {
        return 'let';
    }
    get nullKeyword() {
        return 'null';
    }
    get anyTypeKeyword() {
        return '';
    }
    get intKeyword() {
        return 'int';
    }
    get numberKeyword() {
        return 'float';
    }
    get stringKeyword() {
        return 'string';
    }
    get booleanKeyword() {
        return 'bool';
    }
    get falseKeyword() {
        return 'false';
    }
    get trueKeyword() {
        return 'true';
    }
    get arrayKeyword() {
        return 'array';
    }
    get arrayListKeyword() {
        return '[]';
    }
    get shouldConstructList() {
        return false;
    }
    get mapKeyword() {
        return 'map';
    }
    get publicKeyword() {
        return '';
    }
    get privateKeyword() {
        return '';
    }
    get stringReplacement() {
        return '%s';
    }

    compareTypeOfObjectsMethod(var1, var2) {
        return '';
    }

    equalMethod(var1, var2, negative) {
        let equal = '===';
        if (negative) {
            equal = '!==';
        }
        return `${var1} ${equal} ${var2}`;
    }

    simpleComparison(var1, var2, negative) {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1} ${equal} ${var2}`;
    }
}

module.exports = LanguageDefinition;
