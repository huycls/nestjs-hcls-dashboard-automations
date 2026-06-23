/** BullMQ chỉ bật khi có Redis — tránh ECONNREFUSED lúc dev local */
export function isQueueEnabled() {
  return process.env.QUEUE_ENABLED === 'true';
}
