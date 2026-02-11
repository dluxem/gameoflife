// HTMX configuration
document.body.addEventListener('htmx:configRequest', function(event) {
    // Add antiforgery token to HTMX requests if available
    const token = document.querySelector('input[name="__RequestVerificationToken"]');
    if (token) {
        event.detail.headers['RequestVerificationToken'] = token.value;
    }
});
