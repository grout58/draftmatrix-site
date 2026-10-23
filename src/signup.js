// Email signup: posts {email, sport, company, turnstileToken} to /api/subscribe.
// Only a 200 with {ok:true} counts as success. The Turnstile widget is reset
// after every submit, because each token can be used only once.
(function () {
  var MESSAGES = {
    ok: "Thanks. You're on the list for the cheat sheet.",
    notLive: "Signups open soon — this form isn't live yet.",
    invalid: "Please enter a valid email address.",
    human: "Couldn't verify you're human — please try again.",
    failed: "Something went wrong. Please try again later.",
  };

  function show(el, text, kind) {
    el.textContent = text;
    el.className = "signup-status " + kind;
  }

  // Turnstile adds a hidden cf-turnstile-response input inside its container.
  function token(widget) {
    var input = widget && widget.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  function reset(widget) {
    if (!widget || !window.turnstile) return;
    try { window.turnstile.reset(widget); } catch (e) { /* widget not rendered */ }
  }

  document.querySelectorAll("form.signup-form").forEach(function (form) {
    var status = form.parentNode.querySelector(".signup-status");
    var button = form.querySelector("button");
    var widget = form.querySelector(".cf-turnstile");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = form.elements.email.value.trim();
      if (!form.elements.email.checkValidity() || email === "") {
        show(status, MESSAGES.invalid, "err");
        form.elements.email.focus();
        return;
      }

      button.disabled = true;
      show(status, "Sending…", "");

      fetch(form.action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email,
          sport: form.dataset.sport,
          company: form.elements.company.value,
          turnstileToken: token(widget),
        }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (res.status === 200 && body.ok === true) {
              show(status, MESSAGES.ok, "ok");
              form.reset();
            } else if (res.status === 503) {
              show(status, MESSAGES.notLive, "warn");
            } else if (res.status === 403 && body.reason === "verification failed") {
              show(status, MESSAGES.human, "err");
            } else if (res.status === 400) {
              show(status, MESSAGES.invalid, "err");
            } else {
              show(status, MESSAGES.failed, "err");
            }
          });
        })
        .catch(function () {
          show(status, MESSAGES.failed, "err");
        })
        .then(function () {
          reset(widget);
          button.disabled = false;
        });
    });
  });
})();
