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
        return true;
    }
    get isConstructorInClassDefinition() {
        return false;
    }
    get isConstructorTheNameOfTheClass() {
        return false;
    }
    get isConstructorHeaderEnoughToDefineProperties() {
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
        return "";
    }
    get privateKeyword() {
        return "";
    }
    get returnKeyword() {
        return "return";
    }
    get nullKeyword() {
        return "null";
    }
    get shouldCompareToNull() {
        return false;
    }
    get anyTypeKeyword() {
        return "";
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
    get falseKeyword() {
        return "false";
    }
    get trueKeyword() {
        return "true";
    }
    get arrayKeyword() {
        return "";
    }
    get mapKeyword() {
        return "";
    }
    get enumKeyword() {
        return "class";
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
    get stringQuote() {
        return "'";
    }
    

    compareTypeOfObjectsMethod(var1, var2) {
        return "";
    }

    equalMethod(var1, var2, negative) {
        let equal = "===";
        if (negative) {
            equal = "!==";
        }
        return `${var1} ${equal} ${var2}`;
    }

    simpleComparison(var1, var2, negative) {
        let equal = "==";
        if (negative) {
            equal = "!=";
        }
        return `${var1} ${equal} ${var2}`;
    }
}

module.exports = LanguageDefinition;
