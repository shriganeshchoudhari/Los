import { Injectable, Logger } from '@nestjs/common';
import {
  RuleCondition,
  RuleEvaluationContext,
  RuleOutcome,
  RuleEvaluationResult,
  RuleSeverity,
} from './rule.types';

@Injectable()
export class RuleConditionEvaluator {
  private readonly logger = new Logger(RuleConditionEvaluator.name);

  evaluateCondition(
    condition: RuleCondition,
    ctx: RuleEvaluationContext,
  ): boolean {
    const { field, operator, value, conditions } = condition;

    if (operator === 'and' && conditions) {
      return conditions.every((c) => this.evaluateCondition(c, ctx));
    }
    if (operator === 'or' && conditions) {
      return conditions.some((c) => this.evaluateCondition(c, ctx));
    }

    const fieldValue = this.getFieldValue(field, ctx);
    return this.compareValues(fieldValue, operator, value);
  }

  evaluateSkipConditions(
    skipConditions: RuleCondition[] | undefined,
    ctx: RuleEvaluationContext,
  ): boolean {
    if (!skipConditions || skipConditions.length === 0) return false;
    return skipConditions.some((c) => this.evaluateCondition(c, ctx));
  }

  private getFieldValue(field: string, ctx: RuleEvaluationContext): any {
    const parts = field.split('.');
    let value: any = ctx;

    for (const part of parts) {
      if (value == null) return undefined;
      value = value[part];
    }

    return value;
  }

  private compareValues(fieldValue: any, operator: string, conditionValue: any): boolean {
    const fv = fieldValue;

    switch (operator) {
      case 'exists':
        return fv !== undefined && fv !== null;

      case 'notExists':
        return fv === undefined || fv === null;

      case 'eq':
        return fv === conditionValue;

      case 'neq':
        return fv !== conditionValue;

      case 'gt':
        return typeof fv === 'number' && typeof conditionValue === 'number' && fv > conditionValue;

      case 'gte':
        return typeof fv === 'number' && typeof conditionValue === 'number' && fv >= conditionValue;

      case 'lt':
        return typeof fv === 'number' && typeof conditionValue === 'number' && fv < conditionValue;

      case 'lte':
        return typeof fv === 'number' && typeof conditionValue === 'number' && fv <= conditionValue;

      case 'in':
        if (Array.isArray(conditionValue)) return conditionValue.includes(fv);
        return false;

      case 'nin':
        if (Array.isArray(conditionValue)) return !conditionValue.includes(fv);
        return true;

      case 'contains':
        if (typeof fv === 'string' && typeof conditionValue === 'string') {
          return fv.toLowerCase().includes(conditionValue.toLowerCase());
        }
        if (Array.isArray(fv)) return fv.includes(conditionValue);
        return false;

      default:
        this.logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }
}
