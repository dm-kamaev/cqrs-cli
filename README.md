# CQRS CLI

<!-- [![Actions Status](https://github.com/dm-kamaev/cqrs/workflows/Build/badge.svg)](https://github.com/dm-kamaev/cqrs/actions) -->

CLI library for code generation commands and queries with handlers for package [@ignis-web/cqrs](https://www.npmjs.com/package/@ignis-web/cqrs).

```sh
npm i @ignis-web/cqrs -S
```

### Example
Creating file with types for command and query:
```ts
# example/module/user/type.ts

import { ICommand, IQuery, ICommandHandler, IQueryHandler } from '@ignis-web/cqrs';

export interface ICreateCommand extends ICommand<'user.create', { id: number; name: string }> { };
export interface ICreateHandler extends ICommandHandler<ICreateCommand> { };

export interface IGetByIdQuery extends IQuery<'user.get-by-id', number> { };
export interface IGetByIdHandler extends IQueryHandler<IGetByIdQuery, { id: number, name: string }> { };
```

Generate code:
```sh
npx create-cq -m example/module/user

Output:
example/module/user/
├── cq
│   ├── Create.command.ts
│   ├── Create.handler.ts
│   ├── GetById.handler.ts
│   └── GetById.query.ts
├── index.ts
└── type.ts
```

### Options
```sh
-m, --module <path> – path of module
-f, --folder <path> – folder of Command/Query/Handler, by default is "cq"
-i, --index <path> – name of index file with Command/Query/Handler, by default is "index.ts"
--snake-case – format naming of Command/Query/Handler
```


