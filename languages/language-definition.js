class LanguageDefinition {
    get isTypesafeLanguage() {
        return false;
    }
    get hasNullCheckInProperty() {
        return false;
    }
    get useDataclassForModels() {
        return false;
    }
    get shouldConstructorDefineProperties() {
        return false;
    }
    get isConstructorInClassDefinition() {
        return false;
    }
    get isConstructorTheNameOfTheClass() {
        return false;
    }
    get thisKeyword() {
        return "this";
    }
    get constructKeyword() {
        return "constructor";
    }
    get newKeyword() {
        return "new";
    }
    get classKeyword() {
        return "class";
    }
    get dataClassKeyword() {
        return ""
    }
    get propertyKeyword() {
        return "let";
    }
    get variableKeyword() {
        return "let";
    }
    get constKeyword() {
        return "const";
    }
    get functionKeyword() {
        return "function";
    }
    get privateKeyword() {
        return "";
    }
    get returnKeyword() {
        return "return";
    }
    get intKeyword() {
        return "";
    }
    get numberKeyword() {
        return "";
    }
    get stringKeyword() {
        return "";
    }
    get booleanKeyword() {
        return "";
    }
    get arrayKeyword() {
        return "";
    }
    get mapKeyword() {
        return "";
    }
    get functionReturnTypeSeparator() {
        return "";
    }
    get propertyTypeSeparator() {
        return "";
    }
    get isPropertyTypeAfterName() {
        return false;
    }
}

module.exports = LanguageDefinition;
