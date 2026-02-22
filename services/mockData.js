const products = [
    {
        id: 1,
        name: 'Curso de Marketing Digital',
        price: 1500,
        image: 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        content_link: 'https://example.com/course1',
        description: 'Aprenda marketing digital do zero ao avançado.'
    },

    {
        id: 2,
        name: 'E-book: Finanças Pessoais',
        price: 500,
        image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        content_link: 'https://example.com/ebook1',
        description: 'Organize sua vida financeira hoje.'
    },
    {
        id: 3,
        name: 'Mentoria de Carreira',
        price: 3000,
        image: 'https://images.unsplash.com/photo-1521791136364-798a7bc0d262?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        content_link: 'https://example.com/mentoring',
        description: 'Acelere seu crescimento profissional.'
    }
];

// Estado limpo do Dashboard / Vendedor
let balance = 0;
const sales = [];
const withdrawals = [];

module.exports = {
    products,
    get balance() { return balance; },
    get sales() { return sales; },
    get withdrawals() { return withdrawals; },

    addProduct: (product) => {
        const newId = products.length > 0 ? products[products.length - 1].id + 1 : 1;
        products.push({
            id: newId,
            ...product,
            pixel_id: product.pixel_id || '',
            utmify_id: product.utmify_id || '',
            webhook_url: product.webhook_url || ''
        });
    },

    addSale: (sale) => {
        const newId = `TX${1000 + sales.length + 1}`;
        const newSale = { id: newId, date: new Date().toISOString(), ...sale };
        sales.push(newSale);

        if (newSale.status === 'Concluído') {
            balance += newSale.amount;
        }
        return newSale;
    },

    addWithdrawal: (withdrawal) => {
        const newId = `WD${1000 + withdrawals.length + 1}`;
        const newWd = { id: newId, date: new Date().toISOString(), ...withdrawal };
        withdrawals.push(newWd);

        if (newWd.status === 'Concluído') {
            balance -= newWd.amount;
        }
        return newWd;
    }
};
