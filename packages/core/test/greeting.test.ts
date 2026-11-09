/**
 * @author Codex
 * @date 2026-11-06
 * 问候服务行为测试：通过公开接口验证英文及中文姓名的输出。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DefaultGreetingService, type GreetingService } from '../src/index.js';

const greetingService: GreetingService = new DefaultGreetingService();

/**
 * 验证英文姓名的问候格式。
 * @returns 无返回值，断言失败时抛出异常。
 */
function verifiesEnglishGreeting(): void {
  assert.equal(greetingService.greet('TypeScript'), 'Hello, TypeScript!');
}

/**
 * 验证中文姓名被完整保留。
 * @returns 无返回值，断言失败时抛出异常。
 */
function verifiesChineseGreeting(): void {
  assert.equal(greetingService.greet('开发者'), 'Hello, 开发者!');
}

test('generates an English greeting', verifiesEnglishGreeting);
test('preserves a Chinese name', verifiesChineseGreeting);
