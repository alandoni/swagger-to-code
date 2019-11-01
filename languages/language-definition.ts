import TypeDefinition from "../parser/definitions/type-definition";
import ParameterDefinition from "../parser/definitions/parameter-definition";
import ConstructorDefinition from "../parser/definitions/constructor-definition";
import PropertyDefinition from "../parser/definitions/property-definition";

interface LanguageDefinition {
    name: string;
    fileExtension: string;
    useDataclassForModels: boolean;
    needDeclareFields: boolean;
    isTypeSafeLanguage: boolean;
    thisKeyword: string;
    constKeyword: string;
    variableKeyword: string;
    nullKeyword: string;
    anyTypeKeyword: string;
    intKeyword: string;
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

    printPackage(packageString: string);

    importDeclarations(imports: Array<string>): string;

    classDeclaration(className: string, inheritsFrom: TypeDefinition, implementsInterfaces: Array<TypeDefinition>, body: string, isDataClass: boolean, constructors: Array<ConstructorDefinition>): string;

    methodDeclaration(methodName: string, parameters: Array<ParameterDefinition>, returnType: TypeDefinition, body: string, modifiers: Array<string>): string;

    printParametersNamesWithTypes(parameters: Array<ParameterDefinition>, shouldBreakLine: boolean): string;

    parameterDeclaration(parameter: ParameterDefinition): string;

    printType(type: TypeDefinition): string;

    printValues(values: Array<string>, shouldBreakLine: boolean): string;

    fieldDeclaration(visibility: string, name: string, type: TypeDefinition, defaultValue: string): string;

    methodCall(caller: string, methodName: string, parameterValues: Array<string>): string;

    variableDeclaration(declareType: string, type: TypeDefinition, name: string, defaultValue: string): string;

    returnDeclaration(value: string): string;

    constructorDeclaration(className: string, properties: Array<PropertyDefinition>, returnType: TypeDefinition, body: string, isDataClass: boolean): string;

    enumDeclaration(enumName: string, values: Array<string>): string;

    ifStatement(condition: string, body: string): string;

    whileStatement(condition: string, body: string): string;

    lambdaMethod(caller: string, method: string, varName: string, body: string): string;

    ifNullStatement(object: string, body: string): string;

    assignment(name1: string, name2: string): string;

    constructObject(type: TypeDefinition, parameters: Array<string>): string;

    stringDeclaration(content: string): string;

    tryCatchStatement(tryBody: string, catchBody: string, finallyBody: string): string;

    compareTypeOfObjectsMethod(var1: string, var2: string, negative: boolean): string;

    equalMethod(var1: string, var2: string, negative: boolean): string;

    simpleComparison(var1: string, var2: string, negative: boolean): string;

    arrayComparison(var1: string, var2: string, negative: boolean): string;

    cast(obj: string, type: TypeDefinition): string;
}

export default LanguageDefinition;
