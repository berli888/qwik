import type { JSXNode } from '../../render/jsx/types/jsx-node';
import { createDocument } from '@builder.io/qwik-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { walkJSX } from '../container.unit';
import type { ElementVNode, FragmentVNode, QDocument, VNode } from './types';
import {
  vnode_getFirstChild,
  vnode_getNode,
  vnode_getParent,
  vnode_insertChildAfter,
  vnode_newDeflatedElement,
  vnode_newInflatedText,
  vnode_setProp,
} from './vnode';
import { vnode_applyJournal, vnode_diff, type VNodeJournalEntry } from './vnode-diff';
import '../vdom-diff.unit';

describe('vnode-diff', () => {
  const journal: VNodeJournalEntry[] = [];
  afterEach(() => {
    journal.length = 0;
  });

  it('should find no difference', () => {
    const vnode = vnode_fromJSX(<div>Hello</div>);
    expect(vnode).toMatchVDOM(<div>Hello</div>);
    expect(vnode_getNode(vnode)!.ownerDocument!.body.innerHTML).toEqual('<div>Hello</div>');
    vnode_diff(journal, <div>Hello</div>, vnode);
    expect(journal).toEqual([]);
  });

  describe('text', () => {
    it('should update text', () => {
      const vnode = vnode_fromJSX(<div>Hello</div>);
      vnode_diff(journal, <div>World</div>, vnode);
      expect(vnode).toMatchVDOM(<div>Hello</div>);
      expect(journal).not.toEqual([]);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div>World</div>);
    });

    it('should add missing text node', () => {
      const vnode = vnode_fromJSX(<div></div>);
      vnode_diff(journal, <div>Hello</div>, vnode);
      expect(vnode).toMatchVDOM(<div></div>);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div>Hello</div>);
    });

    it('should update and add missing text node', () => {
      const vnode = vnode_fromJSX(<div>text</div>);
      vnode_diff(journal, <div>Hello {'World'}</div>, vnode);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div>Hello {'World'}</div>);
    });

    it('should remove extra text nodes', () => {
      const vnode = vnode_fromJSX(<div>text{'removeMe'}</div>);
      vnode_diff(journal, <div>Hello</div>, vnode);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div>Hello</div>);
    });
    it('should remove all text nodes', () => {
      const vnode = vnode_fromJSX(<div>text{'removeMe'}</div>);
      vnode_diff(journal, <div></div>, vnode);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div></div>);
    });
    it('should treat undefined as no children', () => {
      const vnode = vnode_fromJSX(<div>text{'removeMe'}</div>);
      vnode_diff(journal, <div>{undefined}</div>, vnode);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(<div></div>);
    });
  });
  describe('element', () => {
    it('should do nothing on same', () => {
      expect(journal.length).toEqual(0);
      const vnode = vnode_fromJSX(
        <test>
          <span></span>
          <b></b>
        </test>
      );
      const test = (
        <test>
          <span></span>
          <b></b>
        </test>
      );
      vnode_diff(journal, test, vnode);
      expect(journal.length).toEqual(0);
      expect(vnode).toMatchVDOM(test);
    });
    it('should add missing element', () => {
      const vnode = vnode_fromJSX(<test></test>);
      const test = (
        <test>
          <span class="B" about="ABOUT"></span>
        </test>
      );
      vnode_diff(journal, test, vnode);
      vnode_applyJournal(journal);
      expect(vnode).toMatchVDOM(test);
    });
    it.only('should update attributes', () => {
      const vnode = vnode_fromJSX(
        <test>
          <span id="a" about="name"></span>
        </test>
      );
      const test = (
        <test>
          <span class="B" about="ABOUT"></span>
        </test>
      );
      vnode_diff(journal, test, vnode);
      vnode_applyJournal(journal);
      console.log('>>>', vnode.toString(), vnode_getNode(vnode)!.outerHTML);
      expect(vnode).toMatchVDOM(test);
    });
  });
  describe.todo('fragments', () => {});
  describe.todo('attributes', () => {});
});

function vnode_fromJSX(jsx: JSXNode): VNode {
  const doc = createDocument() as QDocument;
  doc.qVNodeData = new WeakMap();
  const vBody = vnode_newDeflatedElement(null, doc.body);
  const vPreviousSiblingStack: (VNode | null)[] = [];
  let vParent: ElementVNode | FragmentVNode = vBody;
  let vPreviousSibling: VNode | null = null;
  walkJSX(jsx, {
    enter: (jsx) => {
      const type = jsx.type;
      if (typeof type === 'string') {
        const child = vnode_newDeflatedElement(vParent, doc.createElement(type));
        vnode_insertChildAfter(vParent, vPreviousSibling, child);

        const props = jsx.props;
        for (const key in props) {
          if (Object.prototype.hasOwnProperty.call(props, key)) {
            vnode_setProp(child, key, String(props[key]));
          }
        }
        vPreviousSiblingStack.push(child);
        vParent = child;
      } else {
        throw new Error('Unknown type:' + type);
      }
    },
    leave: (jsx) => {
      vParent = vnode_getParent(vParent) as any;
      vPreviousSibling = vPreviousSiblingStack.pop()!;
    },
    text: (value) => {
      vnode_insertChildAfter(
        vParent,
        vPreviousSibling,
        (vPreviousSibling = vnode_newInflatedText(
          vParent,
          doc.createTextNode(String(value)),
          String(value)
        ))
      );
    },
  });
  return vnode_getFirstChild(vParent)!;
}