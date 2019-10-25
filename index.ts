import YAML from 'yaml';
import fs from 'fs';

import { acceptedLanguages } from './languages/languages';
import LanguageParser from './parser/language-parser';

class Program {

    validateLanguage(language: string) {
        return acceptedLanguages.indexOf(language) > -1;
    }
    
    readFileAndParseYaml(file: string) {
        const yamlFile = fs.readFileSync(file, 'utf8');
        return YAML.parse(yamlFile);
    }
    
    validateYamlSwaggerFile(yamlObject: any) {
        return yamlObject.swagger && 
            yamlObject.swagger === '2.0' &&
            yamlObject.info &&
            yamlObject.basePath && 
            yamlObject.tags && 
            yamlObject.tags.length > 0 &&
            yamlObject.paths && 
            Object.entries(yamlObject.paths).length > 0 &&
            yamlObject.definitions && 
            Object.entries(yamlObject.definitions).length > 0;
    }
    
    processFileWithLanguage(yamlObject: any, language: string) {
        new LanguageParser().parse(yamlObject, language).map((clasz) => {
            const dir = './result';
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
            fs.writeFileSync(`${dir}/${clasz.fileName}`, clasz.content);
        });
    }

    runWithArgs(language: string, file1: string, file2: string) {
        let error: string = null;

        if (!this.validateLanguage(language)) {
            error = 'Invalid language, choose one of KOTLIN, SWIFT, JAVASCRIPT, TYPESCRIPT';
        }
    
        const yamlObject1 = this.readFileAndParseYaml(file1);
    
        if (!this.validateYamlSwaggerFile(yamlObject1)) {
            error = `Invalid YAML swagger file: ${file1}`;
        }
    
        if (file2) {
            const yamlObject2 = this.readFileAndParseYaml(file2);
            if (!this.validateYamlSwaggerFile(yamlObject2)) {
                error = `Invalid YAML swagger file: ${file2}`;
            }
        }

        if (error) {
            console.log(error)
        } else {
            this.processFileWithLanguage(yamlObject1, language);
        }
    }

    main(args: Array<string>) {
        let language = '';
        let file1 = '';
        let file2 = '';
        let error: string = null;

        if (args.length < 4) {
            error = 'Invalid arguments... aborting';
        } else if (args.length >= 4) {
            language = args[2];
            file1 = args[3];
            if (args.length == 5) {
                file2 = args[4];
                error = 'This function is not ready yet, in the future, we will compare 2 files and update the generated code';
            } else if (args.length > 5) {
                error = 'Invalid arguments... aborting';
            }
        }
        if (error) {
            console.log(error);
        } else {
            this.runWithArgs(language, file1, file2);
        }
    }
}

new Program().main(process.argv);