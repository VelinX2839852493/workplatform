/**
 * @author Codex
 * @date 2026-11-06
 * core 问候模块：定义问候服务接口，由默认实现按姓名生成问候语。
 */

/** 问候服务契约，供入口及其他消费者依赖。 */
export interface GreetingService {
  /**
   * 为指定姓名生成问候语。
   * @param name 接收问候的姓名。
   * @returns 包含姓名的问候语。
   */
  greet(name: string): string;
}

/** GreetingService 的默认实现，不依赖外部服务。 */
export class DefaultGreetingService implements GreetingService {
  /**
   * 使用固定格式生成问候语。
   * @param name 接收问候的姓名。
   * @returns 格式为 Hello, 姓名! 的字符串。
   */
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}
