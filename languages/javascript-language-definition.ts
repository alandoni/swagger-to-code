import LanguageDefinition from "./language-definition";
import TypeDefinition from "../parser/definitions/type-definition";
import ParameterDefinition from "../parser/definitions/parameter-definition";
import ConstructorDefinition from "../parser/definitions/constructor-definition";
import PropertyDefinition from "../parser/definitions/property-definition";
import Languages from "./languages";

class JavascriptLanguageDefinition extends LanguageDefinition {
    name = Languages.JAVASCRIPT;
    fileExtension = 'js';
    useDataclassForModels = false;
    needDeclareFields = false;
    isTypeSafeLanguage = false;
    thisKeyword = 'this';
    constKeyword = 'const';
    variableKeyword = 'let';
    nullKeyword = 'null';
    anyTypeKeyword = '';
    intKeyword = 'int';
    longKeyword = 'int';
    numberKeyword = 'float';
    stringKeyword = 'string';
    booleanKeyword = 'bool';
    falseKeyword = 'false';
    trueKeyword = 'true';
    arrayKeyword = 'array';
    arrayListKeyword = '[]';
    shouldConstructList = false;
    mapKeyword = 'map';
    publicKeyword = '';
    privateKeyword = '';
    stringReplacement = '%s';
    equalMethodName = 'isEqual';
    hashCodeMethodName = null;
    varargsKeyword = '...';
    constructorAlsoDeclareFields = false;
    emptySuperMethod = this.methodCall(null, 'super', null);
    overrideKeyword = '';
    hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase = true;
    lambdaMethodsMustCallReturn = true;
    joinMethod: 'join';
    staticKeyword = 'static';

    printPackage(_package: string) {
        return ``;
    }

    importDeclarations(imports: Array<string>): string {
        return imports.map((importFile) => {
            return `const ${importFile} = require(${this.stringDeclaration(`./${importFile}`)});`;
        }).join('\n');
    }

    classDeclaration(className: string, inheritsFrom: TypeDefinition, _implementsInterfaces: Array<TypeDefinition>, body: string, _isDataClass: boolean, _constructors: Array<ConstructorDefinition>): string {
        let inherits = '';
        if (inheritsFrom) {
            inherits = ` extends ${inheritsFrom}`;
        }
        return `class ${className}${inherits} {\n\n${body}\n}`;
    }

    methodDeclaration(methodName: string, parameters: Array<ParameterDefinition>, _returnType: TypeDefinition, body: string, _modifiers: Array<string>): string {
        return `${methodName}(${this.printParametersNamesWithTypes(parameters, false)}) {
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
            return parameter.name;
        }).join(separator);
    }

    parameterDeclaration(parameter: ParameterDefinition): string {
        return parameter.name
    }

    printType(type: TypeDefinition): string {
        if (type.subtype) {
            return `${type.name}<${type.subtype.print(this)}>`;
        } else {
            return  `${type.name}`;
        }
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

    fieldDeclaration(name: string, _type: TypeDefinition, defaultValue: string, _modifiers: Array<string>): string {
        let field = `get ${name}() {\n`;
        if (defaultValue) {
            field += `\t\t${this.returnDeclaration(defaultValue)}`;
        }
        field += '\n\t}';
        return field;
    }

    methodCall(caller: PropertyDefinition, methodName: string, parameterValues: Array<string>): string {
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

    variableDeclaration(declareType: string, _type: TypeDefinition, name: string, defaultValue: string): string {
        let variable = `${declareType} ${name}`;
        if (defaultValue) {
            variable += ` = ${defaultValue}`;
        }
        return variable += ';';
    }

    returnDeclaration(value: string): string {
        return `return ${value};`;
    }

    constructorDeclaration(_className: string, properties: Array<PropertyDefinition>, _returnType: TypeDefinition, _body: string, _isDataClass: boolean): string {
        const parameters = properties.map((property) => {
            return ParameterDefinition.fromProperty(property);
        });
        return `constructor(${this.printParametersNamesWithTypes(parameters, false)}) {
${parameters.map((value) => {
            return `\t\tthis.${value.name} = ${value.name};`;
        }).join('\n')}
\t}`;
    }

    enumDeclaration(enumName: string, values: Array<string>): string {
        return `\tclass ${enumName} {
  ${values.map((value, index) => {
            return `\t\t${value} = ${index}`;
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
        return this.ifStatement(`!${object}`, body);
    }

    ifNotNullStatement(object: string, body: string): string {
        return this.ifStatement(`${object}`, body);
    }

    assignment(name1: string, name2: string): string {
        return `${name1} = ${name2};`;
    }

    constructObject(type: TypeDefinition, parameters: Array<string> = []): string {
        return `new ${this.methodCall(null, type.name, parameters)}`;
    }

    stringDeclaration(content: string): string {
        return `'${content}'`;
    }

    tryCatchStatement(tryBody: string, catchBody: string, finallyBody: string): string {
        return `\t\ttry {
  ${tryBody}
\t\t} catch (error) {
  ${catchBody}
\t\t} finally {
  ${finallyBody}
\t\t}`
    }

    compareTypeOfObjectsMethod(_var1: string, _var2: string, _negative: boolean): string {
        return '';
    }

    equalMethod(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        let equal = '===';
        if (negative) {
            equal = '!==';
        }
        return `${var1} ${equal} ${var2}`;
    }

    simpleComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        let equal = '==';
        if (negative) {
            equal = '!=';
        }
        return `${var1} ${equal} ${var2}`;
    }

    arrayComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string {
        return this.equalMethod(var1, var2, negative);
    }

    cast(_obj: string, _type: TypeDefinition): string {
        return '';
    }

    callProperty(caller: PropertyDefinition, property: PropertyDefinition, insertNullable: boolean = false): string {
        return `${this.printPropertyValue(caller, insertNullable)}.${this.printPropertyValue(property, insertNullable)}`;
    }

    printPropertyValue(property: PropertyDefinition, _insertNullable: boolean = false): string {
        return `${property.name}`;
    }
}

export default JavascriptLanguageDefinition;