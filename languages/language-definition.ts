import TypeDefinition from "../parser/definitions/type-definition";
import ParameterDefinition from "../parser/definitions/parameter-definition";
import ConstructorDefinition from "../parser/definitions/constructor-definition";
import PropertyDefinition from "../parser/definitions/property-definition";

abstract class LanguageDefinition {
    name: string;
    fileExtension: string;
    useDataclassForModels: boolean;
    needDeclareFields: boolean;
    isTypeSafeLanguage: boolean;
    thisKeyword: string;
    constKeyword: string;
    variableKeyword: string;
    staticConstKeyword: string;
    shouldInsertClassNameForStaticConstsInTheSameClass: boolean;
    nullKeyword: string;
    anyTypeKeyword: string;
    intKeyword: string;
    longKeyword: string;
    numberKeyword: string;
    stringKeyword: string;
    booleanKeyword: string;
    falseKeyword: string;
    trueKeyword: string;
    arrayKeyword: string;
    arrayListKeyword: string;
    shouldConstructList: boolean;
    mapKeyword: string;
    publicKeyword: string;
    privateKeyword: string;
    stringReplacement: string;
    equalMethodName: string;
    hashCodeMethodName: string;
    varargsKeyword: string;
    constructorAlsoDeclareFields: boolean;
    emptySuperMethod: string;
    overrideKeyword: string;
    hasConvenienceMethodsToInsertUpdateOrDeleteFromDatabase: boolean;
    lambdaMethodsMustCallReturn: boolean;
    joinMethod: string;
    staticKeyword: string;

    abstract printPackage(packageString: string): string;

    abstract importDeclarations(imports: Array<string>): string;

    abstract classDeclaration(className: string, inheritsFrom: TypeDefinition, implementsInterfaces: Array<TypeDefinition>, body: string, isDataClass: boolean, constructors: Array<ConstructorDefinition>): string;

    abstract methodDeclaration(methodName: string, parameters: Array<ParameterDefinition>, returnType: TypeDefinition, body: string, modifiers: Array<string>): string;

    abstract printParametersNamesWithTypes(parameters: Array<ParameterDefinition>, shouldBreakLine: boolean): string;

    abstract parameterDeclaration(parameter: ParameterDefinition): string;

    abstract printType(type: TypeDefinition): string;

    abstract printValues(values: Array<string>, shouldBreakLine: boolean): string;

    abstract fieldDeclaration(name: string, type: TypeDefinition, defaultValue: string, modifiers: Array<string>): string;

    abstract methodCall(caller: PropertyDefinition, methodName: string, parameterValues: Array<string>): string;

    abstract variableDeclaration(declareType: string, type: TypeDefinition, name: string, defaultValue: string): string;

    abstract returnDeclaration(value: string): string;

    abstract constructorDeclaration(className: string, properties: Array<PropertyDefinition>, returnType: TypeDefinition, body: string, isDataClass: boolean): string;

    abstract enumDeclaration(enumName: string, values: Array<string>): string;

    abstract ifStatement(condition: string, body: string): string;

    abstract whileStatement(condition: string, body: string): string;

    abstract lambdaMethod(caller: string, method: string, varName: string, body: string): string;

    abstract ifNullStatement(object: string, body: string): string;

    abstract ifNotNullStatement(object: string, body: string): string;

    abstract assignment(name1: string, name2: string): string;

    abstract constructObject(type: TypeDefinition, parameters: Array<string>): string;

    abstract stringDeclaration(content: string): string;

    abstract tryCatchStatement(tryBody: string, catchBody: string, finallyBody: string): string;

    abstract compareTypeOfObjectsMethod(var1: string, var2: string, negative: boolean): string;

    abstract equalMethod(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string;

    abstract simpleComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string;

    abstract arrayComparison(var1: PropertyDefinition, var2: PropertyDefinition, negative: boolean): string;

    abstract cast(obj: string, type: TypeDefinition): string;

    abstract callProperty(caller: PropertyDefinition, property: PropertyDefinition, insertNullable: boolean): string;

    abstract printPropertyValue(property: PropertyDefinition, insertNullable: boolean): string;

    abstract appendString(stringVariable: string, stringToAppend): string;
}

export default LanguageDefinition;
