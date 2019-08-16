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
    get isConstructorHeaderEnoughToDefineProperties() {
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
    get nullKeyword() {
        return "null";
    }
    get shouldCompareToNull() {
        return true;
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
    get enumKeyword() {
        return "enum class";
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
    get stringQuote() {
        return "\"";
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
