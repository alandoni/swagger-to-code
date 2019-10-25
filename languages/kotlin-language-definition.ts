import LanguageDefinition from './language-definition';
import ParameterDefinition from '../parser/definitions/parameter-definition';
import TypeDefinition from '../parser/definitions/type-definition';
import ConstructorDefinition from '../parser/definitions/constructor-definition';
import PropertyDefinition from '../parser/definitions/property-definition';

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

    importDeclarations(imports: Array<string>): string {
        return imports.map((importFile) => {
            return `import ${importFile};`;
        }).join('\n');
    }

    classDeclaration(className: string, inheritsFrom: string, body: string, isDataClass: boolean, constructors: Array<ConstructorDefinition>): string {
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

    methodDeclaration(methodName: string, parameters: Array<ParameterDefinition>, returnType: TypeDefinition, body: string): string {
        let returnString = '';
        if (returnType && returnType.print(this) && returnType.print(this).length > 0) {
            returnString = ` : ${returnType.print(this)}`;
        }

        return `fun ${methodName}(${this.printParametersNamesWithTypes(parameters, false)})${returnString} {
${body}
\t}`;
    }

    printParametersNamesWithTypes(parameters: Array<ParameterDefinition>, shouldBreakLine: boolean): string {
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

    parameterDeclaration(parameter: ParameterDefinition): string {
        let declareString = parameter.modifiers ? parameter.modifiers.join(' ') : '';
        if (declareString.length > 1) {
            declareString = `${declareString} `;
        }
        return `${declareString}${parameter.name} : ${parameter.type.print(this)}`;
    }

    printValues(values: Array<string>, shouldBreakLine: boolean): string {
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

    fieldDeclaration(visibility: string, name: string, type: TypeDefinition, defaultValue: string): string {
        let visibilityString = '';
        if (visibility.length > 0) {
            visibilityString = `${visibility} `;
        }
        let field = `${visibilityString}val ${name} : ${type.print(this)}`;
        if (defaultValue) {
            field += ` = ${defaultValue}`;
        }
        field += ';';
        return field;
    }

    methodCall(caller: string, methodName: string, parameterValues: Array<string>): string {
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

    variableDeclaration(declareType: string, type: TypeDefinition, name: string, defaultValue: string): string {
        let variable = `${declareType} ${name} : ${type.print(this)}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable +=';';
    }

    returnDeclaration(value: string): string {
        return `return ${value};`;
    }

    constructorProperties(properties: Array<PropertyDefinition>): string {
        let shouldBreakLine = true;
        if (properties.length < 2) {
            shouldBreakLine = false;
        }
        const parameters = properties.map((property) => {
            return ParameterDefinition.fromProperty(property);
        });
        return `(${this.printParametersNamesWithTypes(parameters, shouldBreakLine)})`;
    }

    constructorDeclaration(className: string, properties: Array<PropertyDefinition>, _returnType: TypeDefinition, body: string, _isDataClass: boolean): string {
        return `${className}${this.constructorProperties(properties)} {
    ${body}
\t}`;
    }

    enumDeclaration(enumName: string, values: Array<string>): string {
        return `\tenum class ${enumName} {
${values.map((value) => {
    return `\t\t${value}`;
}).join(',\n')}
\t}`;
    }

    ifStatement(condition: string, body: string): string {
        return `if (${condition}) {
    ${body}
\t\t}`;
    }

    whileStatement(condition: string, body: string): string {
        return `while (${condition}) {
    ${body}
\t\t}`;
    }

    lambdaMethod(caller: string, method: string, varName: string, body: string): string {
        return `${caller}.${method} { (${varName}) ->
    ${body}
\t\t}`;
    }

    ifNullStatement(object: string, body: string): string {
        return this.ifStatement(`${object} == ${this.nullKeyword}`, body);
    }

    assignment(name1: string, name2: string): string {
        return `${name1} = ${name2};`;
    }

    constructObject(type: TypeDefinition, parameters: Array<string> = []): string {
        return this.methodCall(null, type.name, parameters);
    }

    stringDeclaration(content: string): string {
        return `"${content}"`;
    }

    tryCatchStatement(tryBody: string, catchBody: string, finallyBody: string): string {
        return `\t\ttry {
    ${tryBody}
\t\t} catch (e: Exception) {
    ${catchBody}
\t\t} finally {
    ${finallyBody}
\t\t}`
    }

    compareTypeOfObjectsMethod(var1: string, var2: string, negative: boolean): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1}::class ${equal} ${var2}::class`;
    }

    equalMethod(var1: string, var2: string, negative: boolean): string {
        const equals = `${var1}.${this.equalMethodName}(${var2})`;
        if (negative) {
            return `!${equals}`;
        } else {
            return equals;
        }
    }

    simpleComparison(var1: string, var2: string, negative: boolean): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1} ${equal} ${var2}`;
    }
}

export default KotlinLanguageDefinition;
