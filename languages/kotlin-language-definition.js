class KotlinLanguageDefinition {
    get isTypesafeLanguage() {
        return true;
    }
    get hasNullCheckInProperty() {
        return true;
    }
    get useDataclassForModels() {
        return true;
    }
    get shouldConstructorDefineProperties() {
        return true;
    }
    get isConstructorInClassDefinition() {
        return true;
    }
    get isConstructorTheNameOfTheClass() {
        return true;
    }
    get thisKeyword() {
        return "this";
    }
    get constructKeyword() {
        return "constructor";
    }
    get newKeyword() {
        return "";
    }
    get classKeyword() {
        return "class";
    }
    get dataClassKeyword() {
        return "data class"
    }
    get propertyKeyword() {
        return "val";
    }
    get variableKeyword() {
        return "var";
    }
    get constKeyword() {
        return "val";
    }
    get functionKeyword() {
        return "fun";
    }
    get privateKeyword() {
        return "private";
    }
    get returnKeyword() {
        return "return";
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
    get arrayKeyword() {
        return "Array";
    }
    get mapKeyword() {
        return "Map";
    }
    get functionReturnTypeSeparator() {
        return ":";
    }
    get propertyTypeSeparator() {
        return ":";
    }
    get isPropertyTypeAfterName() {
        return true;
    }
}

module.exports = KotlinLanguageDefinition;
