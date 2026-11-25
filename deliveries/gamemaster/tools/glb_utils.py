import json
from pathlib import Path
import struct

import numpy as np

DTYPES = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
ARRAY_TYPES = {n: t for t, n in WIDTHS.items()}

def read(path):
    data = Path(path).read_bytes()
    magic, version, size, json_len, kind = struct.unpack_from('<4s4I', data)
    assert magic == b'glTF' and version == 2 and size == len(data) and kind == 0x4E4F534A
    bin_len, kind = struct.unpack_from('<II', data, 20 + json_len)
    assert kind == 0x004E4942
    return json.loads(data[20:20 + json_len]), bytearray(data[28 + json_len:28 + json_len + bin_len])

def write(path, model, blob):
    model['buffers'][0]['byteLength'] = len(blob)
    body = json.dumps(model, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
    body += b' ' * (-len(body) % 4)
    blob = bytes(blob) + b'\0' * (-len(blob) % 4)
    header = struct.pack('<4s4I', b'glTF', 2, len(body) + len(blob) + 28, len(body), 0x4E4F534A)
    Path(path).write_bytes(header + body + struct.pack('<II', len(blob), 0x004E4942) + blob)

def view_bytes(model, blob, i):
    view = model['bufferViews'][i]
    start = view.get('byteOffset', 0)
    return blob[start:start + view['byteLength']]

def array(model, blob, i):
    spec = model['accessors'][i]
    view = model['bufferViews'][spec['bufferView']]
    width = WIDTHS[spec['type']]
    dtype = np.dtype(DTYPES[spec['componentType']])
    offset = spec.get('byteOffset', 0) + view.get('byteOffset', 0)
    data = np.ndarray((spec['count'], width), dtype=dtype, buffer=blob,
        offset=offset, strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))
    return data.copy()

def add_view(model, blob, data):
    blob.extend(b'\0' * (-len(blob) % 4))
    entry = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)}
    blob.extend(data)
    model['bufferViews'].append(entry)
    return len(model['bufferViews']) - 1

def add_array(model, blob, values):
    values = np.asarray(values, dtype='<f4')
    if values.ndim == 1:
        values = values[:, None]
    entry = {'bufferView': add_view(model, blob, values.tobytes()), 'componentType': 5126,
             'type': ARRAY_TYPES[values.shape[1]], 'count': len(values),
             'min': values.min(axis=0).tolist(), 'max': values.max(axis=0).tolist()}
    model['accessors'].append(entry)
    return len(model['accessors']) - 1

def node_indices(model):
    return {n['name']: i for i, n in enumerate(model['nodes']) if 'name' in n}

def tracks(model, blob, anim):
    for channel in anim['channels']:
        node = model['nodes'][channel['target']['node']]['name']
        path = channel['target']['path']
        spec = anim['samplers'][channel['sampler']]
        yield node, path, array(model, blob, spec['input']).ravel(), array(model, blob, spec['output'])

def add_track(model, blob, anim, node, path, time, value):
    sampler = len(anim['samplers'])
    anim['samplers'].append({'input': add_array(model, blob, time), 'output': add_array(model, blob, value),
                             'interpolation': 'LINEAR'})
    anim['channels'].append({'sampler': sampler, 'target': {'node': node, 'path': path}})
