"""Compatibility coverage for the patched parser; all fixtures stay in RAM."""

import io

import pytest
from pypdf import PdfWriter
from pypdf.errors import PdfReadError
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.workers.document_tasks import extract_pages


def test_pdf_parser_extracts_real_text_and_preserves_page_numbers():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
    })
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 150 Td (Synthetic study notes) Tj ET")
    page[NameObject("/Contents")] = stream
    writer.add_blank_page(width=300, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    result = extract_pages(buffer.getvalue(), ".pdf")
    assert result[0][0] == 1
    assert "Synthetic study notes" in result[0][1]
    assert result[1] == (2, "")


def test_malformed_pdf_is_rejected_not_silently_indexed():
    with pytest.raises(PdfReadError):
        extract_pages(b"%PDF-1.7\ninvalid synthetic fixture\n", ".pdf")


def test_utf8_text_extraction_is_unchanged():
    assert extract_pages("Tài liệu tổng hợp".encode(), ".txt") == [(None, "Tài liệu tổng hợp")]
