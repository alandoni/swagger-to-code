const LanguageDefinition = require('./language-definition');


class KotlinLanguageDefinition extends LanguageDefinition {
    importDeclarations(imports) {
        return imports.map((importFile) => {
            return `import ${importFile};`;
        }).join('\n');
    }

    classDeclaration(className, inheritsFrom, body, isDataClass, properties) {
        let classType = 'class';
        if (isDataClass) {
            classType = 'data class';
        }
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` : ${inheritsFrom}`;
        }
        let constructor = '';
        if (properties) {
            constructor = this.constructorProperties(properties);
        }
        return `${classType} ${className}${constructor}${inherits} {\n${body}\n}`;
    }

    parameterDeclaration(parameterName, type) {
        return `${type} ${parameterName}`;
    }

    methodDeclaration(methodName, parameters, returnType, body) {
        let returnString = '';
        if (returnType) {
            returnString = ` : ${returnType}`;
        }

        return `fun ${methodName}(${this.printParametersNamesWithTypes(parameters)})${returnString} {
${body}
\t}`;
    }

    printParametersNamesWithTypes(parameters, declareKeyword) {
        if (!parameters || parameters.length == 0) {
            return '';
        }
        return parameters.map((parameter) => {
            let declareString = ''
            if (declareKeyword) {
                declareString = `${declareKeyword} `;
            }
            return `${declareString}${parameter.name} : ${parameter.type}`;
        }).join(',\n\t\t');
    }

    printValues(values) {
        if (!values || values.length === 0) {
            return '';
        }
        return values.map((value) => {
            return `${value}`;
        }).join(', ');
    }

    fieldDeclaration(visibility, name, type, defaultValue) {
        let visibilityString = '';
        if (visibility.length > 0) {
            visibilityString = `${visibility} `;
        }
        let field = `${visibilityString}val ${name} : ${type}`;
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
        return `${callerString}${methodName}(${this.printValues(parameterValues)})`;
    }

    variableDeclaration(declareType, type, name, defaultValue) {
        let variable = `${declareType} ${name} : ${type}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable +=';';
    }

    returnDeclaration(value) {
        return `return ${value};`;
    }

    constructorProperties(properties) {
        return `(${this.printParametersNamesWithTypes(properties, 'val')})`;
    }

    constructorDeclaration(className, parameters, returnType, body, isDataClass) {
        return `${className}${this.constructorProperties(parameters)} {
    ${body}
\t}`;
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

    assignment(name1, name2) {
        return `${name1} = ${name2};`;
    }

    constructObject(type, parameters) {
        return this.methodCall(null, type, parameters);
    }

    ifNullStatement(object, body) {
        return `if (${object} == ${this.nullKeyword}) {
${body}
\t\t}`;
    }

    stringDeclaration(content) {
        return `"${content}"`;
    }

    get useDataclassForModels() {
        return true;
    }
    get isTypesafeLanguage() {
        return true;
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
        return "Any";
    }
    get intKeyword() {
        return "Int";
    }
    get numberKeyword() {
        return "Double";
    }
    get stringKeyword() {
        return "String";
    }
    get booleanKeyword() {
        return "Boolean";
    }
    get falseKeyword() {
        return "false";
    }
    get trueKeyword() {
        return "true";
    }
    get arrayKeyword() {
        return "Array";
    }
    get mapKeyword() {
        return "Map";
    }
    get publicKeyword() {
        return "public";
    }
    get privateKeyword() {
        return "private";
    }
    get stringReplacement() {
        return "%s";
    }

    compareTypeOfObjectsMethod(var1, var2, negative) {
        let equal = "==";
        if (negative) {
            equal = "!=";
        }
        return `${var1}::class ${equal} ${var2}::class`;
    }

    equalMethod(var1, var2, negative) {
        const equals = `${var1}.equals(${var2})`;
        if (negative) {
            return `!${equals}`;
        } else {
            return equals;
        }
    }

    simpleComparison(var1, var2, negative) {
        let equal = "==";
        if (negative) {
            equal = "!=";
        }
        return `${var1} ${equal} ${var2}`;
    }
}

module.exports = KotlinLanguageDefinition;
