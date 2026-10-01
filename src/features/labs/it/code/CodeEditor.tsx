import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import {HighlightStyle,syntaxHighlighting} from '@codemirror/language'
import {tags} from '@lezer/highlight'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import type { CodeLanguage } from './codeTypes'
const syntax = (language: CodeLanguage) =>
  language === 'python'
    ? python()
    : language === 'java'
      ? java()
      : language === 'javascript'
        ? javascript()
        : cpp()
export function CodeEditor({
  value,
  language,
  onChange,
  disabled,
}: {
  value: string
  language: CodeLanguage
  onChange: (code: string) => void
  disabled: boolean
}) {
  const parent = useRef<HTMLDivElement>(null),
    view = useRef<EditorView>(),
    callback = useRef(onChange),
    languagePart = useRef(new Compartment()),
    editablePart = useRef(new Compartment())
  callback.current = onChange
  useEffect(() => {
    if (!parent.current) return
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          syntaxHighlighting(HighlightStyle.define([
            {tag:tags.keyword,color:'var(--accent)'},
            {tag:tags.string,color:'var(--success)'},
            {tag:tags.comment,color:'var(--text-muted)'},
            {tag:[tags.number,tags.bool,tags.null],color:'var(--warning)'},
            {tag:[tags.name,tags.operator,tags.punctuation],color:'var(--text)'},
          ])),
          languagePart.current.of(syntax(language)),
          editablePart.current.of(EditorView.editable.of(!disabled)),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Trình soạn thảo code',
            'aria-describedby': 'code-keyboard-help',
            spellcheck: 'false',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callback.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': {
              fontSize: '14px',
              backgroundColor: 'transparent',
              color: 'var(--text)',
            },
            '.cm-content': {
              fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
              minHeight: '330px',
              caretColor: 'var(--accent)',
            },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
            },
            '.cm-activeLine,.cm-activeLineGutter': {
              backgroundColor: 'var(--surface-soft)',
            },
            '.cm-selectionBackground': {
              backgroundColor: 'var(--border-strong) !important',
            },
            '&.cm-focused': {
              outline: '2px solid var(--accent)',
              outlineOffset: '2px',
            },
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = undefined
    }
    // Initial values only. External updates are applied through transactions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      })
  }, [value])
  useEffect(() => {
    view.current?.dispatch({
      effects: [
        languagePart.current.reconfigure(syntax(language)),
        editablePart.current.reconfigure(EditorView.editable.of(!disabled)),
      ],
    })
  }, [language, disabled])
  return (
    <>
      <div className="it-editor" ref={parent} />
      <p id="code-keyboard-help" className="it-small">
        Tab chuyển sang điều khiển tiếp theo. Ctrl/⌘ + / để bật hoặc tắt chú
        thích.
      </p>
    </>
  )
}
