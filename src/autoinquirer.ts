// tslint:disable:no-any
// tslint:disable:no-console

import { Subject } from 'rxjs';
import { DataSource } from './datasource';
import { PromptBuilder } from './promptbuilder';
import { backPath } from './utils';


export class AutoInquirer {
    public onQuestion: Subject<any> = new Subject();
    public onComplete: Subject<any> = new Subject();

    private dataSource: DataSource;
    private promptBuilder: PromptBuilder;
    private questions: any[];
    private answers: any = {};

    constructor(dataSource: DataSource, initialState: any = {}) {
        this.dataSource = dataSource;
        this.promptBuilder = new PromptBuilder(dataSource);
        this.answers = initialState;
        this.questions = this.promptBuilder.generatePrompts(initialState.state);
    }

    public next() {
        while (this.questions.length!==0) {
            const prompt = { ...this.questions.shift() };
            if (prompt.when({ ...this.answers})) {
                prompt.when = true;
                if (prompt.default && typeof(prompt.default) === 'function') {
                    prompt.default = prompt.default(this.answers);
                }
                if (prompt.choices && typeof(prompt.choices) === 'function') {
                    prompt.choices = prompt.choices(this.answers);
                }

                return prompt;
            } /*
            else {
                console.log("SKIP:", {...prompt})
            }*/
        }
        const { state } = this.answers;
        if (state && state.type !== 'none') {
            //console.log("NO QUESTION", state);
            this.answers.state = { ...state, type: state.type === 'select' ? 'reload' : 'back' };
            this.performActions(this.answers);
            
            return this.next();
        } else {
            this.onComplete.next();
        }
    }

    public onAnswer(data: any) {
        if (/^input\./.test(data.name)) {
            const pair = {}; pair[data.name.split('.').pop()] = data.answer;
            this.answers.input = this.answers.input || {};
            Object.assign(this.answers.input, pair);
        } else {
            this.answers[data.name] = data.answer;
        }
        this.performActions(this.answers);
        this.run();
    }

    public performActions(answers: any) {
        const { state, input } = answers;
    
        //console.log("ACTION:", answers);
        if (state && state.type) {
            switch (state.type) {
                case 'add':
                    if (input) {
                        //console.log("this.dataSource.addItemByPath", state.path, input);     
                        this.dataSource.addItemByPath(state.path, input);     
                    }
                    break;
                case 'edit':
                    if (input) {
                        this.dataSource.updateItemByPath(state.path, input); 
                    }
                    break;
                case 'remove':
                    this.dataSource.removeItemByPath(state.path);
                    break;
                case 'back':
                    break;
                case 'none':
                    this.questions = [];
                    break;
                default:
            }
        }
        if (input || (state && state.type && ['remove', 'back', 'reload'].indexOf(state.type) !== -1)) {
            const newPath = state.type === 'add' || state.type === 'reload' ? state.path : backPath(state.path);
            //console.log(state.type, state.path, newPath);
            this.answers = { state: { path: newPath, type: 'select' } };
            this.questions = this.promptBuilder.generatePrompts(this.answers.state);    
        }
    };

    public inquire(ask: any, answers: any = {}) {
        // tslint:disable-next-line:promise-must-complete
        return new Promise( (resolve: any) => {
            this.answers = answers;
            ask(this.promptBuilder.generatePrompts(answers.state)).then((res: any) => { 
                const { state } = res;
                if (res.state.type !== 'none') {
                    this.performActions(res);
                    const newPath = state.type === 'add' || state.type === 'reload' ? state.path : backPath(state.path);
                    this.inquire(ask, { state: { path: newPath, type: 'select' } }).then(resolve); 
                } else {
                    resolve();
                }
            });    
        });
    };

    public run() {
        this.onQuestion.next(this.next());
    };

}
