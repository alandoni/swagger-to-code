const LanguageDefinition = require('./language-definition');


class KotlinLanguageDefinition extends LanguageDefinition {
    importDeclarations(imports) {
        return imports.map((importFile) => {
            return `import ${importFile};`;
        }).join('\n');
    }

    classDeclaration(className, inheritsFrom, body, isDataClass, constructors) {
        let classType = 'class';
        if (isDataClass) {
            classType = 'data class';
        }
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` : ${inheritsFrom}`;
        }
        let constructor = '';
        if (constructors && constructors.length > 0) {
            constructor = this.constructorProperties(constructors[0].properties);
        }
        return `${classType} ${className}${constructor}${inherits} {\n\n${body}\n}`;
    }

    methodDeclaration(methodName, parameters, returnType, body) {
        let returnString = '';
        if (returnType && returnType.print() && returnType.print().length > 0) {
            returnString = ` : ${returnType.print()}`;
        }

        return `fun ${methodName}(${this.printParametersNamesWithTypes(parameters)})${returnString} {
${body}
\t}`;
    }

    printParametersNamesWithTypes(parameters, shouldBreakLine = false) {
        let separator = ', ';
        if (shouldBreakLine) {
            separator = ',\n\t\t';
        }

        if (!parameters || parameters.length == 0) {
            return '';
        }
        return parameters.map((parameter) => {
            return parameter.print(this);
        }).join(separator);
    }

    parameterDeclaration(parameter) {
        let declareString = parameter.modifiers ? parameter.modifiers.join(' ') : '';
        if (declareString.length > 1) {
            declareString = `${declareString} `;
        }
        return `${declareString}${parameter.name} : ${parameter.type.print(this)}`;
    }

    printValues(values, shouldBreakLine) {
        if (!values || values.length === 0) {
            return '';
        }

        let separator = ', ';
        if (values[0].indexOf('\t') > -1 || (values.length > 1 && values[1].indexOf('\t') > -1)) {
            separator = ',\n\t\t\t';
        }
        if (shouldBreakLine) {
            separator = ',\n\t\t\t';
        }
        return values.map((value) => {
            return `${value}`;
        }).join(separator);
    }

    fieldDeclaration(visibility, name, type, defaultValue) {
        let visibilityString = '';
        if (visibility.length > 0) {
            visibilityString = `${visibility} `;
        }
        let field = `${visibilityString}val ${name} : ${type.print()}`;
        if (defaultValue) {
            field += ` = ${defaultValue}`;
        }
        field += ';';
        return field;
    }

    methodCall(caller, methodName, parameterValues) {
        let callerString = '';
        if (caller) {
            callerString = `${caller}.`;
        }
        let shouldBreakLine = true;
        if (parameterValues && parameterValues.length < 3) {
            shouldBreakLine = false;
        }
        return `${callerString}${methodName}(${this.printValues(parameterValues, shouldBreakLine)})`;
    }

    variableDeclaration(declareType, type, name, defaultValue) {
        let variable = `${declareType} ${name} : ${type.print()}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable +=';';
    }

    returnDeclaration(value) {
        return `return ${value};`;
    }

    constructorProperties(properties) {
        let shouldBreakLine = true;
        if (properties.length < 2) {
            shouldBreakLine = false;
        }
        return `(${this.printParametersNamesWithTypes(properties, shouldBreakLine)})`;
    }

    constructorDeclaration(className, parameters, returnType, body, isDataClass) {
        return `${className}${this.constructorProperties(parameters)} {
    ${body}
\t}`;
    }

    get constructorAlsoDeclareFields() {
        return true;
    }

    enumDeclaration(enumName, values) {
        return `\tenum class ${enumName} {
    ${values.map((value) => {
        return `\t\t${value}`;
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

    assignment(name1, name2) {
        return `${name1} = ${name2};`;
    }

    constructObject(type, parameters) {
        return this.methodCall(null, type, parameters);
    }

    ifNullStatement(object, body) {
        return this.ifStatement(`${object} == ${this.nullKeyword}`, body);
    }

    stringDeclaration(content) {
        return `"${content}"`;
    }

    tryCatchStatement(tryBody, catchBody, finallyBody) {
        return `\t\ttry {
    ${tryBody}
\t\t} catch (e: Exception) {
    ${catchBody}
\t\t} finally {
    ${finallyBody}
\t\t}`
    }

    get useDataclassForModels() {
        return true;
    }
    get isTypesafeLanguage() {
        return true;
    }
    get thisKeyword() {
        return 'this';
    }
    get constKeyword() {
        return 'val';
    }
    get variableKeyword() {
        return 'var';
    }
    get nullKeyword() {
        return 'null';
    }
    get anyTypeKeyword() {
        return 'Any';
    }
    get intKeyword() {
        return 'Int';
    }
    get numberKeyword() {
        return 'Double';
    }
    get stringKeyword() {
        return 'String';
    }
    get booleanKeyword() {
        return 'Boolean';
    }
    get falseKeyword() {
        return 'false';
    }
    get trueKeyword() {
        return 'true';
    }
    get arrayKeyword() {
        return 'Array';
    }
    get arrayListKeyword() {
        return 'ArrayList';
    }
    get shouldConstructList() {
        return true;
    }
    get mapKeyword() {
        return 'Map';
    }
    get publicKeyword() {
        return 'public';
    }
    get privateKeyword() {
        return 'private';
    }
    get stringReplacement() {
        return '%s';
    }

    compareTypeOfObjectsMethod(var1, var2, negative) {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1}::class ${equal} ${var2}::class`;
    }

    equalMethod(var1, var2, negative) {
        const equals = `${var1}.${this.equalMethodName}(${var2})`;
        if (negative) {
            return `!${equals}`;
        } else {
            return equals;
        }
    }

    get equalMethodName() {
        return 'equals';
    }

    simpleComparison(var1, var2, negative) {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1} ${equal} ${var2}`;
    }

    get varargsKeyword() {
        return 'varargs';
    }
}

module.exports = KotlinLanguageDefinition;
