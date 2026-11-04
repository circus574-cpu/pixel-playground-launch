<?php
/** Run inside Coolify. Secrets enter through a private file, never stdout or argv values. */
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Symfony\Component\Yaml\Yaml;

function failStage(string $stage): never { fwrite(STDERR, "Online configuration refused at $stage; no secret values are printed.\n"); exit(1); }
function netKeys($networks): array { if (!is_array($networks)) return []; return array_is_list($networks) ? $networks : array_keys($networks); }
$mode = $argv[1] ?? 'plan';
$service = App\Models\Service::where('uuid','xh4qbckykxsq1iofxdoe5t3h')->firstOrFail();
$original = Yaml::parse($service->docker_compose_raw);
if (!isset($original['services']['app'], $original['services']['web'])) failStage('service shape');
if ((int)$service->compose_parsing_version !== 5) failStage('parser version');
if (array_is_list($original['services']['app']['environment'] ?? [])) failStage('environment shape');
if ($mode === 'plan') {
 echo json_encode(['mode'=>'plan','service'=>$service->uuid,'private_network'=>'ki-multiplayer-db_private','environment_changes'=>['DATABASE_URL','GAME_SERVER_AUTOSTART','GAME_ONLINE_REQUIRED','GAME_WORLD_PUBLIC_ROOT','GAME_SERVER_PORT','GAME_SERVER_TICK_RATE'],'other_services_unchanged'=>true])."\n";
 exit(0);
}
if ($mode !== 'apply' || getenv('KI_ONLINE_CUTOVER_APPROVED') !== '1') failStage('explicit apply guard');
$inputFile = $argv[2] ?? '';
$backupFile = $argv[3] ?? '';
if (!preg_match('#^/tmp/ki-online-cutover-[a-zA-Z0-9_-]+/runtime.env$#',$inputFile) || !preg_match('#^/tmp/ki-online-cutover-[a-zA-Z0-9_-]+/before.json$#',$backupFile)) failStage('private file paths');
$line = trim(file_get_contents($inputFile));
if (!str_starts_with($line, 'DATABASE_URL=')) failStage('runtime input');
$dbUrl = substr($line,strlen('DATABASE_URL='));
$parts = parse_url($dbUrl);
if (($parts['scheme']??'')!=='postgres' || ($parts['user']??'')!=='ki_runtime' || ($parts['host']??'')!=='ki-multiplayer-db-db-1' || ($parts['path']??'')!=='/ki_multiplayer' || !preg_match('/^[0-9a-f]{64}$/',$parts['pass']??'')) failStage('restricted database identity');
if (file_exists($backupFile)) failStage('backup would be overwritten');
$before = null;
try {
 DB::transaction(function () use (&$before,$service,$dbUrl,$backupFile) {
  $s=App\Models\Service::whereKey($service->id)->lockForUpdate()->firstOrFail();
  $raw=Yaml::parse($s->docker_compose_raw);
  $oldEnv=$s->environment_variables()->where('key','DATABASE_URL')->where('is_preview',false)->first();
  $before=['service_id'=>$s->id,'resource_type'=>$s->getMorphClass(),'service'=>array_intersect_key($s->getAttributes(),array_flip(['docker_compose_raw','docker_compose','redact_all_env_values_in_logs','config_hash'])),'environment'=>$oldEnv?->getAttributes(),'routes'=>DB::table('service_applications')->where('service_id',$s->id)->orderBy('id')->get(['id','name','fqdn'])->toArray()];
  if (file_put_contents($backupFile,json_encode($before,JSON_THROW_ON_ERROR),LOCK_EX)===false) throw new RuntimeException('backup');
  chmod($backupFile,0600);
  $env=$oldEnv ?? new App\Models\EnvironmentVariable;
  $env->key='DATABASE_URL';$env->value=$dbUrl;
  $env->resourceable_type=$s->getMorphClass();$env->resourceable_id=$s->id;
  $env->is_preview=false;$env->is_runtime=true;$env->is_buildtime=false;
  $env->is_literal=true;$env->is_multiline=false;$env->uses_legacy_escaping=false;$env->version='4.0.0';
  $env->save();
  $raw['services']['app']['environment']['DATABASE_URL']='${DATABASE_URL}';
  $raw['services']['app']['environment']['GAME_SERVER_AUTOSTART']='1';
  $raw['services']['app']['environment']['GAME_ONLINE_REQUIRED']='1';
  $raw['services']['app']['environment']['GAME_SERVER_PORT']='7420';
  $raw['services']['app']['environment']['GAME_SERVER_TICK_RATE']='20';
  $raw['services']['app']['environment']['GAME_WORLD_PUBLIC_ROOT']='/app/.output/public';
  $raw['services']['app']['expose']=array_values(array_unique(array_merge($raw['services']['app']['expose']??[],['7420'])));
  $networks=$raw['services']['app']['networks']??['default'];
  if (array_is_list($networks)) { if (!in_array('ki-online-db',$networks,true)) $networks[]='ki-online-db'; }
  else $networks['ki-online-db']=null;
  $raw['services']['app']['networks']=$networks;
  $raw['networks']['ki-online-db']=['external'=>true,'name'=>'ki-multiplayer-db_private'];
  $s->docker_compose_raw=Yaml::dump($raw,20,2,Yaml::DUMP_MULTI_LINE_LITERAL_BLOCK);
  $s->redact_all_env_values_in_logs=true;$s->saveQuietly();
  $s->parse();$s->refresh();
  $parsed=Yaml::parse($s->docker_compose);
  $private=[];
  foreach($parsed['networks']??[] as $key=>$definition) if (($definition['name']??$key)==='ki-multiplayer-db_private' && ($definition['external']??false)) $private[]=$key;
  if (!$private || !array_intersect($private,netKeys($parsed['services']['app']['networks']??[]))) throw new RuntimeException('private app network');
  if (array_intersect($private,netKeys($parsed['services']['web']['networks']??[]))) throw new RuntimeException('web must not access database');
  $webEnv=$parsed['services']['web']['environment']??[];
  $webKeys=array_is_list($webEnv)?array_map(fn($v)=>explode('=', $v,2)[0],$webEnv):array_keys($webEnv);
  if (in_array('DATABASE_URL',$webKeys,true)) throw new RuntimeException('database secret in web');
  $afterRoutes=DB::table('service_applications')->where('service_id',$s->id)->orderBy('id')->get(['id','name','fqdn'])->toArray();
  if (json_encode($before['routes'])!==json_encode($afterRoutes)) throw new RuntimeException('routes changed');
 });
 $service->refresh();$service->saveComposeConfigs();
 echo json_encode(['configuration_saved'=>true,'service'=>$service->uuid,'private_database_role'=>'ki_runtime','application_not_restarted'=>true,'backup_written'=>true])."\n";
} catch (Throwable $error) {
 // Don't print exception messages/arguments: Compose helpers may include secret-bearing commands.
 if ($before) {
  try {
   DB::transaction(function()use($before) {
    DB::table('services')->where('id',$before['service_id'])->update($before['service']);
    $query=DB::table('environment_variables')->where('resourceable_type',$before['resource_type'])->where('resourceable_id',$before['service_id'])->where('key','DATABASE_URL')->where('is_preview',false);
    if ($before['environment']) $query->update($before['environment']); else $query->delete();
   });
   $service->refresh();$service->saveComposeConfigs();
  } catch(Throwable $rollback) { failStage('rollback needs operator recovery from private backup'); }
 }
 failStage('configuration validation (previous values restored)');
}
