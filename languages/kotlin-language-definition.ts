import LanguageDefinition from './language-definition';

class KotlinLanguageDefinition implements LanguageDefinition {
    fileExtension = 'kt';
    useDataclassForModels = true;
    isTypesafeLanguage = true;
    thisKeyword = 'this';
    constKeyword = 'val';
    variableKeyword = 'var';
    nullKeyword = 'null';
    anyTypeKeyword = 'Any';
    intKeyword = 'Int';
    numberKeyword = 'Double';
    stringKeyword = 'String';
    booleanKeyword = 'Boolean';
    falseKeyword = 'false';
    trueKeyword = 'true';
    arrayKeyword = 'Array';
    arrayListKeyword = 'ArrayList';
    shouldConstructList = true;
    mapKeyword = 'Map';
    publicKeyword = 'public';
    privateKeyword = 'private';
    stringReplacement = '%s';
    equalMethodName = 'equals';
    varargsKeyword = 'varargs';
    constructorAlsoDeclareFields = true;
    needDeclareFields = false;

    importDeclarations(imports): string {
        return imports.map((importFile) => {
            return `import ${importFile};`;
        }).join('\n');
    }

    classDeclaration(className, inheritsFrom, body, isDataClass, constructors): string {
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

    methodDeclaration(methodName, parameters, returnType, body): string {
        let returnString = '';
        if (returnType && returnType.print() && returnType.print().length > 0) {
            returnString = ` : ${returnType.print()}`;
        }

        return `fun ${methodName}(${this.printParametersNamesWithTypes(parameters)})${returnString} {
${body}
\t}`;
    }

    printParametersNamesWithTypes(parameters, shouldBreakLine = false): string {
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

    parameterDeclaration(parameter): string {
        let declareString = parameter.modifiers ? parameter.modifiers.join(' ') : '';
        if (declareString.length > 1) {
            declareString = `${declareString} `;
        }
        return `${declareString}${parameter.name} : ${parameter.type.print(this)}`;
    }

    printValues(values, shouldBreakLine): string {
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

    fieldDeclaration(visibility, name, type, defaultValue): string {
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

    methodCall(caller, methodName, parameterValues): string {
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

    variableDeclaration(declareType, type, name, defaultValue): string {
        let variable = `${declareType} ${name} : ${type.print()}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable +=';';
    }

    returnDeclaration(value): string {
        return `return ${value};`;
    }

    constructorProperties(properties): string {
        let shouldBreakLine = true;
        if (properties.length < 2) {
            shouldBreakLine = false;
        }
        return `(${this.printParametersNamesWithTypes(properties, shouldBreakLine)})`;
    }

    constructorDeclaration(className, parameters, _returnType, body, _isDataClass): string {
        return `${className}${this.constructorProperties(parameters)} {
    ${body}
\t}`;
    }

    enumDeclaration(enumName, values): string {
        return `\tenum class ${enumName} {
${values.map((value) => {
    return `\t\t${value}`;
}).join(',\n')}
\t}`;
    }

    ifStatement(condition, body): string {
        return `if (${condition}) {
    ${body}
\t\t}`;
    }

    whileStatement(condition, body): string {
        return `while (${condition}) {
    ${body}
\t\t}`;
    }

    lambdaMethod(caller, method, varName, body): string {
        return `${caller}.${method} { (${varName}) ->
    ${body}
\t\t}`;
    }

    assignment(name1, name2): string {
        return `${name1} = ${name2};`;
    }

    constructObject(type, parameters): string {
        return this.methodCall(null, type, parameters);
    }

    ifNullStatement(object, body): string {
        return this.ifStatement(`${object} == ${this.nullKeyword}`, body);
    }

    stringDeclaration(content): string {
        return `"${content}"`;
    }

    tryCatchStatement(tryBody, catchBody, finallyBody): string {
        return `\t\ttry {
    ${tryBody}
\t\t} catch (e: Exception) {
    ${catchBody}
\t\t} finally {
    ${finallyBody}
\t\t}`
    }

    compareTypeOfObjectsMethod(var1, var2, negative): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1}::class ${equal} ${var2}::class`;
    }

    equalMethod(var1, var2, negative): string {
        const equals = `${var1}.${this.equalMethodName}(${var2})`;
        if (negative) {
            return `!${equals}`;
        } else {
            return equals;
        }
    }

    simpleComparison(var1, var2, negative): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1} ${equal} ${var2}`;
    }
}

export default KotlinLanguageDefinition;
