import readline from 'readline';

class StringUtils {
    static regex = new RegExp('(?=[A-Z])', 'g');

    static splitNameWithUnderlines(name: String): String {
        const names = name.split(this.regex);
        return names.join('_');
    }

    static async readln(question: string): Promise<string> {
        return new Promise((resolve: Function) => {
            const reader = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            reader.question(`${question}\n`, function (answer) {
                reader.close();
                resolve(answer);
            });
        });
    }
}

export default StringUtils;