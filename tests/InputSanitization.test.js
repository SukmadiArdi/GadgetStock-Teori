describe('Input Sanitization & XSS Prevention Test (NFR-003: Sanitasi Input Pengguna)', () => {

    /**
     * Helper sanitasi HTML entity encoder untuk mencegah eksekusi kode XSS
     * Mengubah karakter reserved HTML menjadi entitas teks aman.
     */
    function sanitizeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validasi apakah sebuah string mengandung tag script atau event handler berbahaya
     */
    function containsDangerousHtml(str) {
        if (!str) return false;
        const dangerousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            /on\w+\s*=/gi,          // event handler seperti onload=, onerror=, onclick=
            /javascript\s*:/gi,     // skema javascript:
            /<img[^>]+src=[^>]+>/gi // tag img berpotensi exploit atribut
        ];
        return dangerousPatterns.some(pattern => pattern.test(str));
    }

    test('Sanitasi menetralkan script tag berbahaya pada customer_name', () => {
        const maliciousPayload = "<script>alert('XSS Exploit')</script>";
        const sanitized = sanitizeHtml(maliciousPayload);

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).toBe("&lt;script&gt;alert(&#x27;XSS Exploit&#x27;)&lt;&#x2F;script&gt;");
    });

    test('Deteksi payload berbahaya mendeteksi injeksi event listener onerror', () => {
        const payload1 = '<img src="x" onerror="alert(document.cookie)">';
        const payload2 = '<body onload="alert(1)">';

        expect(containsDangerousHtml(payload1)).toBe(true);
        expect(containsDangerousHtml(payload2)).toBe(true);
    });

    test('Sanitasi input transaksi pada notes menetralisir karakter tag HTML', () => {
        const maliciousNotes = 'Harap kirim segera <iframe src="http://evil.com"></iframe>';
        const safeNotes = sanitizeHtml(maliciousNotes);

        expect(safeNotes).not.toContain('<iframe');
        expect(safeNotes).toBe('Harap kirim segera &lt;iframe src=&quot;http:&#x2F;&#x2F;evil.com&quot;&gt;&lt;&#x2F;iframe&gt;');
    });

    test('Sanitasi mempertahankan teks biasa tanpa merusak konten yang valid', () => {
        const normalCustomer = 'Budi Santoso';
        const normalNotes = 'Pembayaran via QRIS, minta struk cetak.';

        expect(sanitizeHtml(normalCustomer)).toBe('Budi Santoso');
        expect(sanitizeHtml(normalNotes)).toBe('Pembayaran via QRIS, minta struk cetak.');
        expect(containsDangerousHtml(normalCustomer)).toBe(false);
    });

    test('Sanitasi menangani input kosong, null, atau non-string dengan aman', () => {
        expect(sanitizeHtml('')).toBe('');
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
        expect(sanitizeHtml(12345)).toBe('');
    });

    test('Karakter kutip ganda dan tunggal di-encode untuk mencegah attribute breakout injection', () => {
        const attributePayload = '" onfocus="alert(1)" dummy="';
        const sanitized = sanitizeHtml(attributePayload);

        expect(sanitized).not.toContain('"');
        expect(sanitized).toBe('&quot; onfocus=&quot;alert(1)&quot; dummy=&quot;');
    });

});
