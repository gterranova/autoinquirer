// tslint:disable:no-any
// tslint:disable:no-console

var program = require('commander');
const inquirer = require('inquirer');
const path = require("path");

const Subject = require('rxjs').Subject;
const { DataSource, AutoInquirer } = require('./dist/autoinquirer');

program
  .version('1.0.0')
  .description('Example json editor')
  .arguments('<jsonfile>')
  .parse(process.argv);

if (!process.argv.length == 1) {
    program.outputHelp();
} else {
    const dataSource = new DataSource(program.args[0]);
    const autoInquirer = new AutoInquirer(dataSource);

    //autoInquirer.inquire(inquirer.prompt).then(() => console.log('') );
    
    const prompts = new Subject();
    const inq = inquirer.prompt(prompts);
    inq.ui.process.subscribe( data => autoInquirer.onAnswer(data));
    autoInquirer.onQuestion.subscribe( prompt => prompts.next(prompt) );
    autoInquirer.onComplete.subscribe(() => prompts.complete() );
    inq.then( () => console.log('') );
    autoInquirer.run();
        
}
