#!/usr/bin/env node

import { Project, ts, IndentationText } from 'ts-morph';
import { program } from 'commander';
import node_path from 'node:path';
import node_fs from 'node:fs';
import promise_mtd from 'promise_mtd';

import CodeBlockWriter from 'code-block-writer';

interface I_data {
  name: string;
  value_of_first_param: string | number | ts.PseudoBigInt;
  interface_command_query_handler: string;
}

interface I_node {
  command?: I_data,
  query?: I_data,
  handler: I_data,
}

class Format_Name {
  constructor(private _is_camel_case: boolean) { }

  extract_command_query_name(input: string) {
    // Snake case - I_get_by_id_command
    if (!this._is_camel_case) {
      return input.replace(/^I_/, '').replace(/_(command|query|handler)$/, '');
      // Camel case - IGetByIdCommand
    } else {
      return input.substring(1).replace(/(Command|Query|Handler)$/, '');
    }
  }

  capitalized_first_word(word: string) {
    if (!this._is_camel_case) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }

  lower_case_first_word(word: string) {
    return word.charAt(0).toLowerCase() + word.slice(1);
  }

  create_command_name(command: string) {
    return !this._is_camel_case ? `${command}_command` : `${command}Command`;
  }

  create_query_name(query: string) {
    return !this._is_camel_case ? `${query}_query` : `${query}Query`;
  }

  create_handler_name(query: string) {
    return !this._is_camel_case ? `${query}_handler` : `${query}Handler`;
  }

}

class File {
  constructor(private _project: Project, private _folder: string) { }

  async to_file(file_name: string, content: string) {
    const path = node_path.join(this._folder, file_name);
    const newSourceFile = this._project.createSourceFile(path, content);
    await newSourceFile.save();
    return path
  }

  async exist(file_name: string) {
    const path = node_path.join(this._folder, file_name);
    return new Promise((resolve) => {
      node_fs.stat(path, function(err) {
        return (err) ? resolve(false) : resolve(true);
      });
    });
  }
}





async function main({ is_camel_case, module_path, folder_cq, index_for_cq }: { is_camel_case: boolean; module_path: string, folder_cq: string; index_for_cq: string }) {
  const project = new Project({
    manipulationSettings: {
      // TwoSpaces, FourSpaces, EightSpaces, or Tab
      indentationText: IndentationText.TwoSpaces,
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
  const sourceFile = project.addSourceFileAtPath(node_path.join(module_path, 'type.ts'));
  const interfaces = sourceFile.getInterfaces();
  const format_name = new Format_Name(is_camel_case);

  const file = new File(project, node_path.join(module_path, folder_cq));

  const hash: Record<string, I_node> = {};
  interfaces.forEach(el => {
    if (el.isExported()) {
      // const parent = el.getExtends().pop()!;
      const parent = el.getBaseTypes().pop();
      if (!parent) {
        return;
      }

      const interface_command_query_handler = parent.getSymbol()?.getName() ?? '';
      const set_cqh = new Set(['ICommand', 'ICommandHandler','IQuery', 'IQueryHandler']);
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
        hash[cq_name] = {} as I_node;
      }
      const data = {
        name: interface_name,
        value_of_first_param,
        interface_command_query_handler,
      };
      if (interface_command_query_handler === 'ICommand') {
        hash[cq_name].command = data;
      } else if (interface_command_query_handler === 'IQuery') {
        hash[cq_name].query = data;
      } else if (interface_command_query_handler === 'ICommandHandler') {
        hash[cq_name].handler = data;
      } else if (interface_command_query_handler === 'IQueryHandler') {
        hash[cq_name].handler = data;
      }

      // console.log(el.getBaseTypes().pop()?.getText());
      // console.log('=====');
    }
  });
  // console.log(hash);

  const writer = new CodeBlockWriter({
    // optional options
    newLine: '\n', // default: "\n"
    indentNumberOfSpaces: 2, // default: 4
    useTabs: false, // default: false
    useSingleQuote: true // default: false
  });


  await promise_mtd.forEachParallel(Object.entries(hash), { pool: 4 }, async ([action_name, data]) => {
    const capitalized_action_name = format_name.capitalized_first_word(action_name);
    const command_file_name = capitalized_action_name +'.command.ts';

    if (data.command && !await file.exist(command_file_name)) {
      const command_name = capitalized_action_name;
      const unique_command_name = data.command.value_of_first_param;
      const interface_of_command = data.command.name;

      const content =
        `import { ${interface_of_command} } from '../type';\n\n`+

        `export default class ${format_name.create_command_name(command_name)} implements ${interface_of_command} {\n`+
        `  readonly __tag = 'command:${unique_command_name}';\n\n`+

        '  // eslint-disable-next-line no-unused-vars\n'+
        `  constructor(public payload: ${interface_of_command}['payload']) {}\n`+
        '}';

      const path = await file.to_file(command_file_name, content);
      console.log(`[SUCCESS]: ${format_name.create_command_name(command_name)} was created in ${path}`);
    }

    const query_file_name = capitalized_action_name + '.query.ts';

    if (data.query && !await file.exist(query_file_name)) {
      const query_name = capitalized_action_name;
      const unique_query_name = data.query.value_of_first_param;
      const interface_of_query = data.query.name;

      const content =
        `import { ${interface_of_query} } from '../type';\n\n`+

        `export default class ${format_name.create_query_name(query_name)} implements ${interface_of_query} {\n`+
        `  readonly __tag = 'query:${unique_query_name}';\n\n`+

        '  // eslint-disable-next-line no-unused-vars\n'+
        `  constructor(public payload: ${interface_of_query}['payload']) {}\n`+
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

      const content =
        `import { ${interface_of_cq}, ${interface_of_handler} } from '../type';\n\n`+

        `export default class ${format_name.create_handler_name(handler_name)} implements ${interface_of_handler} {\n`+
        `  readonly __tag = '${is_command ? 'command' : 'query'}:${unique_query_name}';\n\n`+

        `  async exec({ payload }: ${interface_of_cq}) {}\n`+
        '}';

      const path = await file.to_file(handler_file_name, content);
      console.log(`[SUCCESS]: ${format_name.create_handler_name(handler_name)} was created in ${path}`);
    }

    if (data.command) {
      const command_name = format_name.capitalized_first_word(action_name);
      writer
        .writeLine(`import ${format_name.create_command_name(command_name)} from '.${node_path.join(folder_cq, command_name+'.command')}';`)
        .writeLine(`import ${format_name.create_handler_name(command_name)} from '.${node_path.join(folder_cq, command_name + '.handler')}';`)
        .writeLine('');
    }

    if (data.query) {
      const query_name = format_name.capitalized_first_word(action_name);
      writer
        .writeLine(`import ${format_name.create_query_name(query_name)} from '.${node_path.join(folder_cq, query_name + '.query')}';`)
        .writeLine(`import ${format_name.create_handler_name(query_name)} from '.${node_path.join(folder_cq, query_name + '.handler')}';`)
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

  node_fs.writeFileSync(node_path.join(module_path, index_for_cq), writer.toString());

}


program
  .description('CLI for generate Command/Query/Handler classes by type file')
  .requiredOption('-m, --module <path>', 'path of module')
  .option('--snake-case', 'format naming of Command/Query/Handler')
  .option('-f, --folder <path>', 'folder of Command/Query/Handler, by default is "cq"', 'cq')
  .option('-i, --index <path>', 'name of index file with Command/Query/Handler, by default is "index.ts"', 'index.ts')
;
program.parse();

const opts = program.opts();
const is_camel_case = opts.snakeCase ? false : true; // default: false;
const module_path = node_path.resolve(opts.module);
const folder_cq = `/${opts.folder}/`;
const index_for_cq = opts.index;

main({ is_camel_case, module_path, folder_cq, index_for_cq });

