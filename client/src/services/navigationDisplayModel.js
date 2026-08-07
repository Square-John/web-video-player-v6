/*
  navigationDisplayModel.js 模块说明

  - 文件职责:
      把固定导航项和动态导航上下文整理为桌面、移动第二行与移动抽屉可以直接消费的确定顺序。
      桌面继续服从路由 meta.nav.order，移动端统一采用反向上下文优先的产品顺序。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      NAVIGATION_CONTEXT_KEY: 自定义导航上下文枚举，避免本模块重复维护搜索、详情和播放身份字符串。

  - 模块级常量:
      MOBILE_NAVIGATION_KEY_ORDER: ReadonlyArray<string>，移动第二行和抽屉共同使用的完整导航 key 顺序。
      MOBILE_NAVIGATION_ORDER_BY_KEY: ReadonlyMap<string, number>，按 key 提供稳定移动排序值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      validateNavigationItem(item, index): 校验待投影导航项具备唯一 key 和有限桌面顺序。
      createGroupedProjection(items, compareItems): 排序并标注可关闭/固定入口组边界。
      createNavigationDisplayModel(fixedItems, contextItems): 生成引用隔离的桌面和移动导航数组。

  - 模块级类:
      无

  - 对外导出:
      MOBILE_NAVIGATION_KEY_ORDER: 移动导航完整顺序契约。
      createNavigationDisplayModel: 统一导航展示模型工厂。
*/

import {
  // 导入来源: ./navigationContextService.js；导入内容: NAVIGATION_CONTEXT_KEY；文件作用: 复用动态导航的标准 key。
  NAVIGATION_CONTEXT_KEY
} from './navigationContextService.js';

// 类型: ReadonlyArray<string>。
// 作用: 冻结移动第二行和抽屉共同顺序；动态反向链路优先，固定入口随后按产品导航顺序排列。
export const MOBILE_NAVIGATION_KEY_ORDER = Object.freeze([
  NAVIGATION_CONTEXT_KEY.player,
  NAVIGATION_CONTEXT_KEY.detail,
  NAVIGATION_CONTEXT_KEY.search,
  'home',
  'movie',
  'tv',
  'profile',
  'settings'
]);

// 类型: ReadonlyMap<string, number>。
// 作用: 把移动顺序数组转换为 O(1) 排序索引；Map 只在模块内部读取，不向调用方暴露可变引用。
const MOBILE_NAVIGATION_ORDER_BY_KEY = new Map(
  MOBILE_NAVIGATION_KEY_ORDER.map((key, index) => [key, index])
);

/**
 * 校验单个导航展示输入。
 * 纯函数: 只读取传入对象并返回隔离副本，不修改路由定义、上下文或调用方数组。
 * 成功路径: key 属于冻结移动顺序且 desktopOrder 为有限数字时返回标准展示项。
 * 失败路径: 输入缺失、key 未登记或桌面顺序非法时抛出 TypeError，阻止新增入口静默落入错误位置。
 *
 * @param {object} item 固定导航或动态上下文展示项。
 * @param {number} index 当前合并数组索引，仅用于稳定错误定位。
 * @returns {object} 带 desktopOrder 和 mobileOrder 的引用隔离展示项。
 * @throws {TypeError} 当输入不满足导航展示契约时抛出。
 */
function validateNavigationItem(item, index) {
  // 条件分支: 当前输入不是普通对象时进入。
  // 执行内容: 立即拒绝，避免后续属性读取把结构问题降级成模糊排序结果。
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError(`导航展示项 ${index} 必须是对象`);
  }

  // 类型: string；作用: 标准化当前导航身份，空白 key 不能进入布局模型。
  const key = typeof item.key === 'string' ? item.key.trim() : '';
  // 条件分支: key 为空或没有进入冻结移动顺序时进入。
  // 执行内容: 要求产品顺序与新入口在同一变更中显式联动，禁止使用最大值兜底。
  if (!key || !MOBILE_NAVIGATION_ORDER_BY_KEY.has(key)) {
    throw new TypeError(`导航展示项 ${index} 使用了未登记 key: ${key || 'empty'}`);
  }

  // 类型: number；作用: 读取路由元信息派生的桌面排序值，桌面不维护第二份 key 顺序。
  const desktopOrder = Number(item.order);
  // 条件分支: 桌面排序不是有限数字时进入。
  // 执行内容: 失败关闭，避免 NaN 让 Array.sort 产生依赖输入顺序的结果。
  if (!Number.isFinite(desktopOrder)) {
    throw new TypeError(`导航展示项 ${key} 缺少有效桌面顺序`);
  }

  return {
    ...item,
    key,
    desktopOrder,
    mobileOrder: MOBILE_NAVIGATION_ORDER_BY_KEY.get(key)
  };
}

/**
 * 创建带明确组边界的只读导航投影。
 * 纯函数: 复制输入后排序，并只在可关闭属性相对前项变化时标记 startsGroup；不依赖数组固定索引或 CSS 结构选择器。
 * 成功路径: 桌面可形成固定、上下文、固定三个连续段，移动端形成上下文、固定两个连续段。
 * 失败路径: compareItems 不是函数时抛出 TypeError，不返回顺序不确定的部分结果。
 *
 * @param {Array<object>} items 已校验的统一导航项。
 * @param {Function} compareItems 当前投影的排序比较器。
 * @returns {ReadonlyArray<object>} 排序、分组且引用隔离的只读导航项。
 * @throws {TypeError} 排序比较器无效时抛出。
 */
function createGroupedProjection(items, compareItems) {
  // 条件分支: 调用方没有提供明确排序比较器时进入；执行内容: 失败关闭，禁止沿用输入偶然顺序。
  if (typeof compareItems !== 'function') {
    throw new TypeError('导航展示投影必须提供排序比较器');
  }

  // 类型: Array<object>；作用: 复制并排序统一输入，后续组边界只比较最终相邻项目。
  const orderedItems = [...items].sort(compareItems);
  return Object.freeze(orderedItems.map((item, index) => {
    // 类型: object|undefined；作用: 读取最终排序中的前一项，首项没有分隔边界。
    const previousItem = index > 0 ? orderedItems[index - 1] : undefined;
    // 类型: boolean；作用: 只有可关闭上下文和固定入口发生切换时建立视觉组边界。
    const startsGroup = Boolean(previousItem)
      && Boolean(previousItem.isContext) !== Boolean(item.isContext);
    return Object.freeze({ ...item, startsGroup });
  }));
}

/**
 * 创建桌面与移动端统一导航展示模型。
 * 纯函数: 合并后逐项复制并分别排序，不修改固定项、上下文项或其中的原对象。
 * 成功路径: desktopItems 服从路由顺序，mobileItems 服从冻结反向链路顺序，移动第二行和抽屉共享同一数组。
 * 失败路径: 数组非法、key 重复或任一项目契约不完整时抛出 TypeError，不返回部分模型。
 *
 * @param {Array<object>} fixedItems 路由表派生的固定导航项。
 * @param {Array<object>} contextItems NavigationContextService 派生的动态导航项。
 * @returns {Readonly<object>} 包含 desktopItems 和 mobileItems 的冻结展示模型。
 * @throws {TypeError} 当输入数组或导航项不满足契约时抛出。
 */
export function createNavigationDisplayModel(fixedItems, contextItems) {
  // 条件分支: 任一输入不是数组时进入。
  // 执行内容: 拒绝把缺失状态当成空导航，调用方必须显式提供两类投影。
  if (!Array.isArray(fixedItems) || !Array.isArray(contextItems)) {
    throw new TypeError('导航展示模型必须接收固定项数组和上下文项数组');
  }

  // 类型: Array<object>；作用: 合并并校验全部当前可见入口，后续两个顺序都从同一标准集合生成。
  const normalizedItems = [...fixedItems, ...contextItems]
    .map((item, index) => validateNavigationItem(item, index));
  // 类型: Set<string>；作用: 检查固定项和动态项没有重复 key，避免渲染键和关闭命令归属冲突。
  const uniqueKeys = new Set(normalizedItems.map(item => item.key));
  // 条件分支: 去重数量与真实数量不一致时进入。
  // 执行内容: 失败关闭，禁止后写覆盖或 Vue v-for 重用错误节点。
  if (uniqueKeys.size !== normalizedItems.length) {
    throw new TypeError('导航展示模型包含重复 key');
  }

  // 类型: ReadonlyArray<object>；作用: 为桌面导航提供严格路由元信息顺序和独立对象引用。
  const desktopItems = createGroupedProjection(
    normalizedItems,
    (leftItem, rightItem) => leftItem.desktopOrder - rightItem.desktopOrder
  );
  // 类型: ReadonlyArray<object>；作用: 为移动第二行和抽屉提供同一反向链路优先顺序和独立对象引用。
  const mobileItems = createGroupedProjection(
    normalizedItems,
    (leftItem, rightItem) => leftItem.mobileOrder - rightItem.mobileOrder
  );

  return Object.freeze({
    desktopItems,
    mobileItems
  });
}
