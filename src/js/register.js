// Registration form: client-side validation using Vanilla's p-form-validation states.
// Submissions are not stored yet — swap out `submitEntry` to post to a backend or form service.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitEntry(entry) {
  // e.g. return fetch('/api/register', { method: 'POST', body: JSON.stringify(entry) });
  console.info('Registration (not sent anywhere yet):', entry);
}

export function initRegistration(form, notification, data) {
  const select = form.elements.section;
  for (const section of data.sections) {
    select.append(new Option(section.name, section.id));
  }

  const eventDate = new Date(`${data.event.date}T00:00:00`);

  const validators = {
    name: (v) => (v.trim().length < 2 ? 'Enter your full name.' : ''),
    email: (v) => (!v.trim() ? 'Enter your email address.' : !EMAIL.test(v.trim()) ? 'Enter a valid email address, like name@example.com.' : ''),
    phone: (v) => (v.trim() && !/^[+\d][\d\s()-]{6,}$/.test(v.trim()) ? 'Enter a valid phone number, or leave it blank.' : ''),
    dob: (v) => {
      if (!v) return 'Enter your date of birth.';
      const dob = new Date(`${v}T00:00:00`);
      if (Number.isNaN(dob.getTime()) || dob >= eventDate) return 'Enter a valid date of birth.';
      return '';
    },
    fideId: (v) => (v.trim() && !/^\d{4,10}$/.test(v.trim()) ? 'FIDE IDs are 4–10 digits.' : ''),
    rating: (v) => {
      if (v === '') return '';
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 3000 ? '' : 'Enter a whole number between 0 and 3000.';
    },
    section: (v, values) => {
      if (!v) return 'Choose a section.';
      if (v === 'u1600' && values.rating !== '' && Number(values.rating) >= 1600) {
        return 'U1600 is for players rated under 1600. Choose Open instead.';
      }
      if (v === 'juniors' && values.dob && ageOn(new Date(`${values.dob}T00:00:00`), eventDate) >= 14) {
        return 'Juniors must be under 14 on the day of the event.';
      }
      return '';
    },
    rules: (_, values) => (values.rules ? '' : 'You must agree to the tournament rules to enter.'),
  };

  // Fields whose validity depends on others.
  const dependents = { rating: ['section'], dob: ['section'] };

  const values = () => {
    const fd = new FormData(form);
    return {
      name: fd.get('name') ?? '',
      email: fd.get('email') ?? '',
      phone: fd.get('phone') ?? '',
      dob: fd.get('dob') ?? '',
      section: fd.get('section') ?? '',
      club: fd.get('club') ?? '',
      fideId: fd.get('fideId') ?? '',
      rating: fd.get('rating') ?? '',
      bye: fd.get('bye') === 'on',
      rules: fd.get('rules') === 'on',
    };
  };

  const touched = new Set();

  function validateField(name, all = values()) {
    const message = validators[name](all[name], all);
    const input = form.elements[name];
    const group = input.closest('.p-form-validation');
    const msg = group?.querySelector('.p-form-validation__message');
    group?.classList.toggle('is-error', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (msg) {
      msg.textContent = message;
      msg.hidden = !message;
    }
    return !message;
  }

  for (const name of Object.keys(validators)) {
    const input = form.elements[name];
    const event = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'blur';
    input.addEventListener(event, () => {
      touched.add(name);
      validateField(name);
      for (const dep of dependents[name] ?? []) if (touched.has(dep)) validateField(dep);
    });
    // Clear an error as soon as it is fixed.
    input.addEventListener('input', () => {
      if (input.closest('.is-error')) validateField(name);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const all = values();
    const results = Object.keys(validators).map((name) => [name, validateField(name, all)]);
    Object.keys(validators).forEach((n) => touched.add(n));
    const firstInvalid = results.find(([, ok]) => !ok);
    if (firstInvalid) {
      showNotification(notification, 'negative', 'Please check your entry', 'Some fields need your attention.');
      form.elements[firstInvalid[0]].focus();
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await submitEntry(all);
      const sectionName = data.sections.find((s) => s.id === all.section).name;
      showNotification(
        notification,
        'positive',
        'Entry received',
        `Thanks, ${all.name.trim().split(' ')[0]} — you're down for the ${sectionName} section. A confirmation will be sent to ${all.email.trim()}.`,
      );
      form.reset();
      touched.clear();
      notification.focus();
    } catch {
      showNotification(notification, 'negative', 'Something went wrong', 'Your entry could not be sent. Please try again.');
    } finally {
      button.disabled = false;
    }
  });
}

function ageOn(dob, date) {
  let age = date.getFullYear() - dob.getFullYear();
  const m = date.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && date.getDate() < dob.getDate())) age--;
  return age;
}

function showNotification(el, type, title, message) {
  el.className = `p-notification--${type}`;
  el.setAttribute('role', type === 'negative' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="p-notification__content">
      <h3 class="p-notification__title"></h3>
      <p class="p-notification__message"></p>
    </div>`;
  el.querySelector('.p-notification__title').textContent = title;
  el.querySelector('.p-notification__message').textContent = message;
}
