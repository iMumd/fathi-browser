
  const rotateBtn = $('#device-rotate');
  const isMobile = !!(tab && tab.fp && tab.fp.device && tab.fp.device.mobile);
  rotateBtn.classList.toggle('hidden', !isMobile);
}

function openDevicePopover() {
  const pop = $('#device-popover');
  renderDevicePopover();
  pop.classList.remove('hidden');
  const rect = $('#chip-device').getBoundingClientRect();
  const width = 292;
  let left = rect.right - width;
  if (left < 12) left = 12;
  if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
  let top = rect.bottom + 8;
  const maxH = 430;
  if (top + maxH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - maxH - 12);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function closeDevicePopover() {
  $('#device-popover').classList.add('hidden');
}

$('#chip-device').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('#device-popover');
  if (pop.classList.contains('hidden')) openDevicePopover();
  else closeDevicePopover();
});

$('#device-rotate').addEventListener('click', (e) => {
  e.stopPropagation();
  const tab = activeTab();
  if (!tab || !tab.fp.device || !tab.fp.device.mobile) return;
  changeDevice(tab.fp.device, tab.fp.device.orientation !== 'landscape');
