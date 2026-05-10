/**
 * 商品数据加载器 - 从静态 JSON 文件加载
 */
const Products = {
    _data: null,

    async load() {
        if (this._data) return this._data;
        const resp = await fetch('data/products.json');
        this._data = await resp.json();
        return this._data;
    },

    getItem(id) {
        if (!this._data) return null;
        return this._data.items.find(item => item.id === id);
    },

    getAll() {
        return this._data ? this._data.items : [];
    }
};
