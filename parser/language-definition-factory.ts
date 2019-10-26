import Languages from '../languages/languages';
import LanguageDefinition from '../languages/language-definition';
import KotlinLanguageDefinition from '../languages/kotlin-language-definition';
import JavascriptLanguageDefinition from '../languages/javascript-language-definition';

export class LanguageDefinitionFactory {
    static makeLanguageDefinition(language: string): LanguageDefinition {
        if (language === Languages.KOTLIN) {
            return new KotlinLanguageDefinition();
        }
        else if (language === Languages.SWIFT) {
            return null; //new SwiftLanguageDefinition();
        }
        else if (language === Languages.TYPESCRIPT) {
            return null; //new TypescriptLanguageDefinition();
        }
        else {
            return new JavascriptLanguageDefinition();
        }
    }
}
