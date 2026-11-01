<?php
/** Private recovery only. Never prints exception messages or secret-bearing configuration. */
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (getenv('KI_ONLINE_CUTOVER_APPROVED') !== '1' || ($argv[1] ?? '') !== '/tmp/ki-online-cutover-rollback/before.json') exit(2);
try {
 $before = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
 $s = App\Models\Service::where('uuid', 'xh4qbckykxsq1iofxdoe5t3h')->firstOrFail();
 if ($s->id !== $before['service_id'] || $s->getMorphClass() !== $before['resource_type']) exit(2);
 Illuminate\Support\Facades\DB::transaction(function () use ($s, $before) {
  Illuminate\Support\Facades\DB::table('services')->where('id', $s->id)->update($before['service']);
  $query = Illuminate\Support\Facades\DB::table('environment_variables')->where('resourceable_type', $before['resource_type'])->where('resourceable_id', $s->id)->where('key', 'DATABASE_URL')->where('is_preview', false);
  if ($before['environment']) $query->update($before['environment']); else $query->delete();
 });
 $s->refresh(); $s->saveComposeConfigs();
 echo "Previous Ki Legends configuration restored; database data retained\n";
} catch (Throwable $error) {
 fwrite(STDERR, "Configuration recovery failed; inspect private recovery files without logging secrets\n"); exit(1);
}
