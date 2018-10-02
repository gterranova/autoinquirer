// tslint:disable:no-any
// tslint:disable:no-console
require('source-map-support').install();
const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');

const Subject = require('rxjs').Subject;
const { Dispatcher, JsonSchema, MemoryDataSource, MongoDataSource, AutoInquirer, PromptBuilder } = require('./build/src');

async function main() { // jshint ignore:line
    const mongoDataSource = new MongoDataSource({ 
        uri: 'mongodb+srv://gianpaolo:*****@cluster0-wrvuf.mongodb.net?retryWrites=true', 
        databaseName: 'my-transmission',
        collectionName: 'test'
    });
    
    const dispatcher = new Dispatcher(
        new JsonSchema(program.args[0]), 
        program.args[1] ? new MemoryDataSource(program.args[1]) : mongoDataSource,
        new PromptBuilder()
    );
    dispatcher.registerProxy('mongodb', mongoDataSource);

    await dispatcher.connect(); // jshint ignore:line

    const autoInquirer = new AutoInquirer(dispatcher);

    //autoInquirer.inquire(inquirer.prompt).then(() => console.log('') );
    
    const prompts = new Subject();
    const inq = inquirer.prompt(prompts);
    const bottomBar = new inquirer.ui.BottomBar();
    inq.ui.process.subscribe( data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
    autoInquirer.on('prompt', prompt => prompts.next(prompt) );
    autoInquirer.on('error', state => { 
        const errorString = state.errors+'\n'; 
        bottomBar.updateBottomBar(chalk.red(errorString));
    });
    autoInquirer.on('exit', state => console.log(state));
    autoInquirer.on('complete', () => prompts.complete() );
    inq.then( () => dispatcher.close() );

    process.on('unhandledRejection', (err, p) => {
        console.log('An unhandledRejection occurred');
        console.log(`Rejected Promise: ${p}`);
        console.log(`Rejection:`, err);
        dispatcher.close();
      });

    autoInquirer.run();

}
  
program
  .version('1.0.0')
  .description('Example json editor')
  .arguments('<jsonfile>')
  .parse(process.argv);

if (program.args.length < 1) {
    program.outputHelp();
} else {
    main();
}
