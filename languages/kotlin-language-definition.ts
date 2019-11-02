import LanguageDefinition from './language-definition';
import ParameterDefinition from '../parser/definitions/parameter-definition';
import TypeDefinition from '../parser/definitions/type-definition';
import ConstructorDefinition from '../parser/definitions/constructor-definition';
import PropertyDefinition from '../parser/definitions/property-definition';
import Languages from './languages';

class KotlinLanguageDefinition extends LanguageDefinition {
    name = Languages.KOTLIN;
    fileExtension = 'kt';
    useDataclassForModels = true;
    isTypeSafeLanguage = true;
    thisKeyword = 'this';
    constKeyword = 'val';
    variableKeyword = 'var';
    nullKeyword = 'null';
    anyTypeKeyword = 'Any';
    intKeyword = 'Int';
    longKeyword = 'Long';
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
    hashCodeMethodName = 'hashCode';
    varargsKeyword = 'vararg';
    constructorAlsoDeclareFields = true;
    needDeclareFields = false;
    emptySuperMethod = this.methodCall(null, 'super', null);
    overrideKeyword = 'override';
    hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase = true;
    lambdaMethodsMustCallReturn = false;
    joinMethod = 'joinToString';
    staticKeyword = 'static';

    printPackage(packageString: string) {
        return `package ${packageString}`;
    }

    importDeclarations(imports: Array<string>): string {
        return imports.map((importFile) => {
            return `import ${importFile}`;
        }).join('\n');
    }

    classDeclaration(className: string, inheritsFrom: TypeDefinition, implementsInterfaces: Array<TypeDefinition>, body: string, isDataClass: boolean, constructors: Array<ConstructorDefinition>): string {
        let classType = 'class';
        if (isDataClass) {
            classType = 'data class';
        }
        let constructor = '';
        if (constructors && constructors.length > 0) {
            constructor = this.constructorProperties(constructors[0].properties);
        }
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` : ${inheritsFrom.name}`;
            if (constructor.length > 0) {
                inherits += '()';
            }
        }
        if (implementsInterfaces.length > 0) {
            const interfacesString = implementsInterfaces.map((interfaceType) => {
                return interfaceType.print(this);
            }).join(', ');
            inherits += `, ${interfacesString}`;
        }
        return `${classType} ${className}${constructor}${inherits} {\n\n${body}\n}`;
    }

    private handleModifiers(modifiers: Array<string>) {
        if (modifiers) {
            const validModifiers = modifiers.filter((modifier) => {
                return modifier !== this.staticKeyword;
            });

            if (validModifiers && validModifiers.length > 0) {
                let modifiersString = validModifiers.join(' ');
                modifiersString += ' ';
                return modifiersString;
            }
        }
        return '';
    }

    methodDeclaration(methodName: string, parameters: Array<ParameterDefinition>, returnType: TypeDefinition, body: string, modifiers: Array<string>): string {
        let returnString = '';
        if (returnType && returnType.print(this) && returnType.print(this).length > 0) {
            returnString = ` : ${returnType.print(this)}`;
        }
        return `${this.handleModifiers(modifiers)}fun ${methodName}(${this.printParametersNamesWithTypes(parameters, false)})${returnString} {
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

    printType(type: TypeDefinition): string {
        let nullable = '';
        if (type.nullable) {
            nullable = '?';
        }
        let result = '';
        if (type.subtype && !type.isEnum) {
            result = `${type.name}<${type.subtype.print(this)}>${nullable}`;
        } else {
            result =  `${type.name}${nullable}`;
        }
        return result;
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

    fieldDeclaration(name: string, type: TypeDefinition, defaultValue: string, modifiers: Array<string>): string {
        let field = `${this.handleModifiers(modifiers)}val ${name} : ${type.print(this)}`;
        if (defaultValue) {
            field += ` = ${defaultValue}`;
        }
        return field;
    }

    methodCall(caller: PropertyDefinition, methodName: string, parameterValues: Array<string>): string {
        let callerString = '';
        if (caller) {
            callerString = `${this.printPropertyValue(caller, true)}.`;
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
        return variable;
    }

    returnDeclaration(value: string): string {
        return `return ${value}`;
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
\t\t\t${body}
\t\t}`;
    }

    whileStatement(condition: string, body: string): string {
        return `while (${condition}) {
\t${body}
\t\t}`;
    }

    lambdaMethod(caller: string, method: string, varName: string, body: string): string {
        let name = '';
        if (varName) {
            name = ` ${varName} ->`
        }
        return `${caller}.${method} {${name}
\t\t\t${body}
\t\t}`;
    }

    ifNullStatement(object: string, body: string): string {
        return this.ifStatement(`${object} == ${this.nullKeyword}`, body);
    }

    ifNotNullStatement(object: string, body: string): string {
        return this.ifStatement(`${object} != ${this.nullKeyword}`, body);
    }

    assignment(name1: string, name2: string): string {
        return `${name1} = ${name2}`;
    }

    constructObject(type: TypeDefinition, parameters: Array<string> = []): string {
        return this.methodCall(null, type.name, parameters);
    }

    stringDeclaration(content: string): string {
        if (content.indexOf('\n') > -1) {
            return `"""${content}"""`;
        }
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

    equalMethod(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        return this.simpleComparison(var1, var2, negative);
    }

    simpleComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${this.printPropertyValue(var1, false)} ${equal} ${this.printPropertyValue(var2, false)}`;
    }

    arrayComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        let equal = '';
        if (negative) {
            equal = '!';
        }
        const callMethod = this.methodCall(var1, 'contentDeepEquals', [`${var2.name}`]);
        return `${equal}${callMethod}`;
    }

    cast(obj: string, type: TypeDefinition): string {
        return `${obj} as ${type.print(this)}`;
    }

    companionObject(body: string) {
        return `\tcompanion object {
${body}
\t}`;
    }

    callProperty(caller: PropertyDefinition, property: PropertyDefinition, insertNullable: boolean = false): string {
        return `${this.printPropertyValue(caller, insertNullable)}.${property.name}`;
    }

    printPropertyValue(property: PropertyDefinition, insertNullable: boolean = false): string {
        let nullable = '';
        if (property.type.nullable && insertNullable) {
            nullable = '?';
        }
        return `${property.name}${nullable}`;
    }
}

export default KotlinLanguageDefinition;
