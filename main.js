// tslint:disable:no-any
// tslint:disable:no-console
require('source-map-support').install();
const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');
const path = require("path");

const Subject = require('rxjs').Subject;
const { FileSystemDataSource, AutoInquirer } = require('./build/src');

program
  .version('1.0.0')
  .description('Example json editor')
  .arguments('<jsonfile>')
  .parse(process.argv);

if (program.args.length !== 2) {
    program.outputHelp();
} else {
    const dataSource = new FileSystemDataSource(program.args[0], program.args[1]);
    dataSource.initialize().then( _ => {
        const autoInquirer = new AutoInquirer(dataSource);

        //autoInquirer.inquire(inquirer.prompt).then(() => console.log('') );
        
        const prompts = new Subject();
        const inq = inquirer.prompt(prompts);
        const bottomBar = new inquirer.ui.BottomBar();
        inq.ui.process.subscribe( data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
        autoInquirer.on('prompt', prompt => prompts.next(prompt) );
        autoInquirer.on('error', state => { 
            const errorString = state.errors.map( err => err.message ).join('\n')+'\n'; 
            bottomBar.updateBottomBar(chalk.red(errorString));
        });
        autoInquirer.on('exit', state => console.log(state));
        autoInquirer.on('complete', () => prompts.complete() );
        inq.then( () => console.log('') );
        autoInquirer.run();
    
    });
        
}
