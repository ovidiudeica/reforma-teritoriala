"""Validate native full-file ordering evidence, independently of source acceptance."""
import re

def validate_order(native,receipt,expected):
    if receipt.get('status')!='INDEPENDENT_NATIVE_ALL_OBJECT_ORDER_CHECK_PASS':raise ValueError('Incomplete native validation')
    if type(receipt.get('native_exit_code')) is not int or receipt['native_exit_code']!=0:raise ValueError('Native process failed')
    if receipt.get('global_sorting_verified') is not True or receipt.get('source_stat_unchanged') is not True:raise ValueError('Order/source stat not established')
    if receipt.get('source_qualified') is not False or receipt.get('provenance_human_or_signed_validation_pending') is not True:raise ValueError('Order proof cannot approve provenance/source')
    for field in ('original_sha256','executable_sha256','native_stdout_sha256','prior_integrity_proof_sha256','positive_negative_fixture_sha256'):
        if not isinstance(receipt.get(field),str) or re.fullmatch('[0-9a-f]{64}',receipt[field]) is None:raise ValueError('Missing digest binding')
        if receipt[field]!=expected[field]:raise ValueError('Digest mismatch')
    if type(native['file']['size']) is not int or native['file']['size']!=expected['source_bytes']:raise ValueError('Incomplete/wrong source size')
    if native['header']['with_history'] is not True or native['data']['multiple_versions'] is not True:raise ValueError('Not full history')
    if native['header']['option']['osmosis_replication_timestamp']!=expected['base_epoch'] or native['data']['timestamp']['last']!=expected['base_epoch']:raise ValueError('Wrong source epoch')
    if native['data']['objects_ordered'] is not True:raise ValueError('Objects unordered')
    for kind in ('nodes','ways','relations'):
        value=native['data']['count'][kind]
        if type(value) is not int or value<=0:raise ValueError('Missing complete object count')
    return dict(global_sorting_verified=True,source_qualified=False,source_promoted=False,
                provenance_human_or_signed_validation_pending=True,geometry_certified=False,
                original_sha256=receipt['original_sha256'],base_epoch=expected['base_epoch'])
