#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts_morph_1 = require("ts-morph");
const commander_1 = require("commander");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const promise_mtd_1 = __importDefault(require("promise_mtd"));
const code_block_writer_1 = __importDefault(require("code-block-writer"));
class Format_Name {
    _is_camel_case;
    constructor(_is_camel_case) {
        this._is_camel_case = _is_camel_case;
    }
    extract_command_query_name(input) {
        // Snake case - I_get_by_id_command
        if (!this._is_camel_case) {
            return input.replace(/^I_/, '').replace(/_(command|query|handler)$/, '');
            // Camel case - IGetByIdCommand
        }
        else {
            return input.substring(1).replace(/(Command|Query|Handler)$/, '');
        }
    }
    capitalized_first_word(word) {
        if (!this._is_camel_case) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    }
    lower_case_first_word(word) {
        return word.charAt(0).toLowerCase() + word.slice(1);
    }
    create_command_name(command) {
        return !this._is_camel_case ? `${command}_command` : `${command}Command`;
    }
    create_query_name(query) {
        return !this._is_camel_case ? `${query}_query` : `${query}Query`;
    }
    create_handler_name(query) {
        return !this._is_camel_case ? `${query}_handler` : `${query}Handler`;
    }
}
class File {
    _project;
    _folder;
    constructor(_project, _folder) {
        this._project = _project;
        this._folder = _folder;
    }
    async to_file(file_name, content) {
        const path = node_path_1.default.join(this._folder, file_name);
        const newSourceFile = this._project.createSourceFile(path, content);
        await newSourceFile.save();
        return path;
    }
    async exist(file_name) {
        const path = node_path_1.default.join(this._folder, file_name);
        return new Promise((resolve) => {
            node_fs_1.default.stat(path, function (err) {
                return (err) ? resolve(false) : resolve(true);
            });
        });
    }
}
async function main({ is_camel_case, module_path, folder_cq, index_for_cq }) {
    const project = new ts_morph_1.Project({
        manipulationSettings: {
            // TwoSpaces, FourSpaces, EightSpaces, or Tab
            indentationText: ts_morph_1.IndentationText.TwoSpaces,
            // // LineFeed or CarriageReturnLineFeed
            // newLineKind: NewLineKind.LineFeed,
            // // Single or Double
            // quoteKind: QuoteKind.Double,
            // Whether to change shorthand property assignments to property assignments
            // and add aliases to import & export specifiers (see more information in
            // the renaming section of the documentation).
            // usePrefixAndSuffixTextForRename: false,
            // Whether to use trailing commas in multi-line scenarios where trailing
            // commas would be used.
            // useTrailingCommas: false,
        },
    });
    const sourceFile = project.addSourceFileAtPath(node_path_1.default.join(module_path, 'type.ts'));
    const interfaces = sourceFile.getInterfaces();
    const format_name = new Format_Name(is_camel_case);
    const file = new File(project, node_path_1.default.join(module_path, folder_cq));
    const hash = {};
    interfaces.forEach(el => {
        if (el.isExported()) {
            // const parent = el.getExtends().pop()!;
            const parent = el.getBaseTypes().pop();
            if (!parent) {
                return;
            }
            const interface_command_query_handler = parent.getSymbol()?.getName() ?? '';
            const set_cqh = new Set(['ICommand', 'ICommandHandler', 'IQuery', 'IQueryHandler']);
            if (!set_cqh.has(interface_command_query_handler)) {
                return;
            }
            const first_param_of_interface = parent.getTypeArguments()[0];
            const value_of_first_param = first_param_of_interface.getSymbol()?.getName() || first_param_of_interface.getLiteralValue();
            if (!value_of_first_param) {
                return;
            }
            // console.log(el.getText());
            // console.log(value_of_first_param);
            // console.log(interface_command_query_handler);
            const interface_name = el.getName();
            const cq_name = format_name.extract_command_query_name(interface_name);
            if (!hash[cq_name]) {
                hash[cq_name] = {};
            }
            const data = {
                name: interface_name,
                value_of_first_param,
                interface_command_query_handler,
            };
            if (interface_command_query_handler === 'ICommand') {
                hash[cq_name].command = data;
            }
            else if (interface_command_query_handler === 'IQuery') {
                hash[cq_name].query = data;
            }
            else if (interface_command_query_handler === 'ICommandHandler') {
                hash[cq_name].handler = data;
            }
            else if (interface_command_query_handler === 'IQueryHandler') {
                hash[cq_name].handler = data;
            }
            // console.log(el.getBaseTypes().pop()?.getText());
            // console.log('=====');
        }
    });
    // console.log(hash);
    const writer = new code_block_writer_1.default({
        // optional options
        newLine: '\n',
        indentNumberOfSpaces: 2,
        useTabs: false,
        useSingleQuote: true // default: false
    });
    await promise_mtd_1.default.forEachParallel(Object.entries(hash), { pool: 4 }, async ([action_name, data]) => {
        const capitalized_action_name = format_name.capitalized_first_word(action_name);
        const command_file_name = capitalized_action_name + '.command.ts';
        if (data.command && !await file.exist(command_file_name)) {
            const command_name = capitalized_action_name;
            const unique_command_name = data.command.value_of_first_param;
            const interface_of_command = data.command.name;
            const content = `import { ${interface_of_command} } from '../type';\n\n` +
                `export default class ${format_name.create_command_name(command_name)} implements ${interface_of_command} {\n` +
                `  readonly __tag = 'command:${unique_command_name}';\n\n` +
                '  // eslint-disable-next-line no-unused-vars\n' +
                `  constructor(public payload: ${interface_of_command}['payload']) {}\n` +
                '}';
            const path = await file.to_file(command_file_name, content);
            console.log(`[SUCCESS]: ${format_name.create_command_name(command_name)} was created in ${path}`);
        }
        const query_file_name = capitalized_action_name + '.query.ts';
        if (data.query && !await file.exist(query_file_name)) {
            const query_name = capitalized_action_name;
            const unique_query_name = data.query.value_of_first_param;
            const interface_of_query = data.query.name;
            const content = `import { ${interface_of_query} } from '../type';\n\n` +
                `export default class ${format_name.create_query_name(query_name)} implements ${interface_of_query} {\n` +
                `  readonly __tag = 'query:${unique_query_name}';\n\n` +
                '  // eslint-disable-next-line no-unused-vars\n' +
                `  constructor(public payload: ${interface_of_query}['payload']) {}\n` +
                '}';
            const path = await file.to_file(query_file_name, content);
            console.log(`[SUCCESS]: ${format_name.create_query_name(query_name)} was created in ${path}`);
        }
        const handler_file_name = capitalized_action_name + '.handler.ts';
        if (data.handler && !await file.exist(handler_file_name)) {
            const handler_name = capitalized_action_name;
            const interface_of_cq = data.handler.value_of_first_param;
            const interface_of_handler = data.handler.name;
            const is_command = data.command ? true : data.query ? false : false;
            const unique_query_name = data.command ? data.command.value_of_first_param : data.query?.value_of_first_param;
            const content = `import { ${interface_of_cq}, ${interface_of_handler} } from '../type';\n\n` +
                `export default class ${format_name.create_handler_name(handler_name)} implements ${interface_of_handler} {\n` +
                `  readonly __tag = '${is_command ? 'command' : 'query'}:${unique_query_name}';\n\n` +
                `  async exec({ payload }: ${interface_of_cq}) {}\n` +
                '}';
            const path = await file.to_file(handler_file_name, content);
            console.log(`[SUCCESS]: ${format_name.create_handler_name(handler_name)} was created in ${path}`);
        }
        if (data.command) {
            const command_name = format_name.capitalized_first_word(action_name);
            writer
                .writeLine(`import ${format_name.create_command_name(command_name)} from '.${node_path_1.default.join(folder_cq, command_name + '.command')}';`)
                .writeLine(`import ${format_name.create_handler_name(command_name)} from '.${node_path_1.default.join(folder_cq, command_name + '.handler')}';`)
                .writeLine('');
        }
        if (data.query) {
            const query_name = format_name.capitalized_first_word(action_name);
            writer
                .writeLine(`import ${format_name.create_query_name(query_name)} from '.${node_path_1.default.join(folder_cq, query_name + '.query')}';`)
                .writeLine(`import ${format_name.create_handler_name(query_name)} from '.${node_path_1.default.join(folder_cq, query_name + '.handler')}';`)
                .writeLine('');
        }
    });
    writer.write('export default ').inlineBlock(() => {
        const list = Object.entries(hash);
        let count = 0;
        for (const [action_name, data] of list) {
            const cq_name = format_name.capitalized_first_word(action_name);
            if (count !== 0) {
                writer.newLine();
            }
            writer.write(`${format_name.lower_case_first_word(action_name)}: `).inlineBlock(() => {
                writer
                    .writeLine(`action: ${data.command ? format_name.create_command_name(cq_name) : format_name.create_query_name(cq_name)},`)
                    .write(`handler: ${format_name.create_handler_name(cq_name)},`);
            }).write(',');
            count++;
        }
    }).write(';');
    node_fs_1.default.writeFileSync(node_path_1.default.join(module_path, index_for_cq), writer.toString());
}
commander_1.program
    .description('CLI for generate Command/Query/Handler classes by type file')
    .requiredOption('-m, --module <path>', 'path of module')
    .option('--snake-case', 'format naming of Command/Query/Handler')
    .option('-f, --folder <path>', 'folder of Command/Query/Handler, by default is "cq"', 'cq')
    .option('-i, --index <path>', 'name of index file with Command/Query/Handler, by default is "index.ts"', 'index.ts');
commander_1.program.parse();
const opts = commander_1.program.opts();
const is_camel_case = opts.snakeCase ? false : true; // default: false;
const module_path = node_path_1.default.resolve(opts.module);
const folder_cq = `/${opts.folder}/`;
const index_for_cq = opts.index;
main({ is_camel_case, module_path, folder_cq, index_for_cq });
//# sourceMappingURL=create-cq.js.map