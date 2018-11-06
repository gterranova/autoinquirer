import { IPrompt, IProperty } from './interfaces';
import { DataRenderer } from './datasource';
export declare type Item = any;
export declare class PromptBuilder extends DataRenderer {
    render(methodName: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt>;
    private getActions;
    private checkAllowed;
    private makeMenu;
    private makePrompt;
    private getChoices;
    private getName;
    private isPrimitive;
    private isCheckBox;
    private isSelect;
    private getOptions;
    private evaluate;
}
