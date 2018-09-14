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
    }

    public next() {
        this.questions = this.promptBuilder.generatePrompts(this.answers.state);
        while (this.questions.length!==0) {
            const prompt = { ...this.questions.shift() };
            if (!prompt.when || prompt.when({ ...this.answers})) {
                prompt.when = true;
                if (prompt.default && typeof(prompt.default) === 'function') {
                    prompt.default = prompt.default(this.answers);
                }
                if (prompt.choices && typeof(prompt.choices) === 'function') {
                    prompt.choices = prompt.choices(this.answers);
                }

                return prompt;
            }
        }
        const { state } = this.answers;
        if (state && state.type !== 'none') {
            //console.log("NO QUESTION", state);
            this.answers.state = { ...state, type: 'back' };
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
    }

    public performActions(answers: any) {
        const { state } = answers;
        let input = answers.input;
        const propertySchema = this.dataSource.getSchemaByPath(state.path);
    
        //console.log("ACTION:", answers, propertySchema.type);
        if (state && state.type) {
            switch (state.type) {
                case 'add':
                    if (input) {
                        this.dataSource.addItemByPath(state.path, input.value);     
                    } else if (propertySchema.type === 'array' && propertySchema.items.type !== 'collection') {
                        //console.log("this.dataSource.addItemByPath", state.path);     
                        input = {};
                        this.dataSource.addItemByPath(state.path, input);
                    } 
                    break;
                case 'edit':
                    if (input) {
                        this.dataSource.updateItemByPath(state.path, input.value); 
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
        if (input || (state && state.type && ['remove', 'back'].indexOf(state.type) !== -1)) {
            const newPath = state.type === 'add' ? state.path : backPath(state.path);
            //console.log(state.type, state.path, newPath,);
            this.answers = { state: { path: newPath, type: 'select' } };
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
                    const newPath = state.type === 'add' ? state.path : backPath(state.path);
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
